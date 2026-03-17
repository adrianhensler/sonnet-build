/**
 * engine.js
 * TextParticleEngine — renders text as a particle cloud, then explodes it
 * into a swirling vortex.
 *
 * Pipeline
 * --------
 *   1. setText(text, font)
 *      → rasterises text onto an off-screen 2-D canvas
 *      → samples lit pixels to build a world-space target array
 *      → spawns particles at random off-screen positions
 *   2. State machine drives the animation:
 *        FORMING   – exponential-ease particles toward text targets
 *        FORMED    – gentle floating idle; auto-triggers explosion
 *        EXPLODING – velocity burst outward, per-particle drag
 *        VORTEX    – polar-coordinate spiral inward with fade
 *        DONE      – brief pause then auto-restart
 *
 * Performance notes
 * -----------------
 * All per-particle data lives in typed Float32Arrays backed directly by
 * THREE.BufferAttribute, so the JS loop writes directly into GPU-mapped
 * memory.  Dynamic usage hints prevent unnecessary buffer re-allocations.
 *
 * Uses a custom ShaderMaterial (not PointsMaterial) to support per-particle
 * size, per-particle alpha, and an additive glow effect.
 */

import * as THREE from 'three';

// ─── State constants ──────────────────────────────────────────────────────────
const S = Object.freeze({ IDLE: 0, FORMING: 1, FORMED: 2, EXPLODING: 3, VORTEX: 4, DONE: 5 });
const STATE_NAMES = ['idle', 'forming', 'formed', 'exploding', 'vortex', 'done'];

// Maximum live particles (size of all typed arrays below)
const MAX = 6000;

// ─── GLSL shaders ─────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  attribute vec3  aColor;   // per-particle RGB
  attribute float aSize;    // per-particle world-space radius
  attribute float aAlpha;   // per-particle opacity
  attribute float aShape;   // 0=circle,1=triangle,2=square,3=diamond,4=hex

  varying vec3  vColor;
  varying float vAlpha;
  varying float vShape;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vShape = aShape;
    vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
    // boosted so particles read larger on mobile / at a distance
    gl_PointSize = aSize * (460.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vShape;

  // signed-ish masks for simple flat geometric sprites
  float maskCircle(vec2 p) {
    return 1.0 - smoothstep(0.48, 0.5, length(p));
  }

  float maskSquare(vec2 p) {
    float d = max(abs(p.x), abs(p.y));
    return 1.0 - smoothstep(0.47, 0.5, d);
  }

  float maskDiamond(vec2 p) {
    float d = abs(p.x) + abs(p.y);
    return 1.0 - smoothstep(0.67, 0.72, d);
  }

  float maskTriangle(vec2 p) {
    // upright equilateral-ish triangle in point-sprite space
    p.y += 0.12;
    float d1 = p.y + 0.5;
    float d2 = (0.866 * p.x - 0.5 * p.y) + 0.35;
    float d3 = (-0.866 * p.x - 0.5 * p.y) + 0.35;
    float inside = min(min(d1, d2), d3);
    return smoothstep(-0.02, 0.02, inside);
  }

  float maskHex(vec2 p) {
    p = abs(p);
    float d = max(p.x * 0.866 + p.y * 0.5, p.y) - 0.42;
    return 1.0 - smoothstep(0.0, 0.04, d);
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;

    float shapeMask;
    if (vShape < 0.5) {
      shapeMask = maskCircle(uv);
    } else if (vShape < 1.5) {
      shapeMask = maskTriangle(uv);
    } else if (vShape < 2.5) {
      shapeMask = maskSquare(uv);
    } else if (vShape < 3.5) {
      shapeMask = maskDiamond(uv);
    } else {
      shapeMask = maskHex(uv);
    }

    if (shapeMask < 0.01) discard;

    float dist = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.16, dist);
    float rim  = 1.0 - smoothstep(0.18, 0.5, dist);
    float alpha = (shapeMask * 0.8 + rim * 0.35 + core * 0.55) * vAlpha;

    gl_FragColor = vec4(vColor * alpha + core * 0.25, alpha);
  }
`;

// ─── Engine class ─────────────────────────────────────────────────────────────

export class TextParticleEngine {
  /**
   * @param {Object}   opts
   * @param {Element}  opts.mount          – container element for the WebGL canvas
   * @param {Object}   opts.preset         – one entry from presets.js
   * @param {Function} [opts.onStateChange] – callback(stateName: string)
   * @param {Function} [opts.onFontChange]  – callback(font: Object)
   */
  constructor({ mount, preset, onStateChange, onFontChange }) {
    this.mount          = mount;
    this.preset         = preset;
    this.onStateChange  = onStateChange  || (() => {});
    this.onFontChange   = onFontChange   || (() => {});

    // Runtime config (mirrored from preset, overridable via updateConfig())
    this.cfg = {
      speed:         preset.speed,
      intensity:     preset.intensity,
      particleCount: preset.particleCount,
    };

    // Internal state
    this._state         = S.IDLE;
    this._stateTime     = 0;
    this._currentText   = preset.defaultText;
    this._currentFont   = null;
    this._pendingExplode = false; // requested during FORMING
    this._rafId         = null;

    // ── Typed arrays for particle data ────────────────────────────────────
    // Positions, targets, velocities stored interleaved (x,y,z per particle)
    this._pos  = new Float32Array(MAX * 3); // current world positions
    this._tgt  = new Float32Array(MAX * 3); // text-pixel target positions
    this._vel  = new Float32Array(MAX * 3); // velocities (explosion phase)
    this._col  = new Float32Array(MAX * 3); // aColor RGB
    this._sz   = new Float32Array(MAX);     // aSize
    this._al   = new Float32Array(MAX);     // aAlpha
    this._sh   = new Float32Array(MAX);     // aShape
    this._ph   = new Float32Array(MAX);     // random phase per particle
    this._drag = new Float32Array(MAX);     // per-particle drag (explosion)
    this._pr   = new Float32Array(MAX);     // polar radius  (vortex)
    this._pa   = new Float32Array(MAX);     // polar angle   (vortex)
    this._baseSz = new Float32Array(MAX);   // original size (for vortex shrink)
    this._count = 0; // number of active particles

    this._initThree();
  }

  // ── Three.js initialisation ───────────────────────────────────────────────

  _initThree() {
    const w = this.mount.clientWidth  || window.innerWidth;
    const h = this.mount.clientHeight || window.innerHeight;

    // Scene
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(this.preset.background);

    // Camera: perspective, moved closer for larger particle presence
    this._camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 200);
    this._camera.position.z = 5.6;

    // Renderer
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(w, h);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.mount.appendChild(this._renderer.domElement);

    // ── BufferGeometry for Points ─────────────────────────────────────────
    const geo = new THREE.BufferGeometry();

    this._posAttr = new THREE.BufferAttribute(this._pos, 3);
    this._colAttr = new THREE.BufferAttribute(this._col, 3);
    this._szAttr  = new THREE.BufferAttribute(this._sz,  1);
    this._alAttr  = new THREE.BufferAttribute(this._al,  1);
    this._shAttr  = new THREE.BufferAttribute(this._sh,  1);

    // Dynamic usage — we update these every frame
    [this._posAttr, this._colAttr, this._szAttr, this._alAttr, this._shAttr].forEach(a => {
      a.setUsage(THREE.DynamicDrawUsage);
    });

    geo.setAttribute('position', this._posAttr);
    geo.setAttribute('aColor',   this._colAttr);
    geo.setAttribute('aSize',    this._szAttr);
    geo.setAttribute('aAlpha',   this._alAttr);
    geo.setAttribute('aShape',   this._shAttr);
    geo.setDrawRange(0, 0); // nothing visible until setText()

    // Custom ShaderMaterial: per-particle size & alpha, additive glow
    this._mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
    });

    this._points = new THREE.Points(geo, this._mat);
    this._scene.add(this._points);

    // Clock for delta-time
    this._clock = new THREE.Clock();

    // Resize handler
    this._onResize = () => {
      const w = this.mount.clientWidth  || window.innerWidth;
      const h = this.mount.clientHeight || window.innerHeight;
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Bootstrap: load a random font, sample default text, start the loop.
   * Must be called once after construction.
   */
  async init() {
    const { pickRandomFont } = await import('./fonts.js');
    this._currentFont = pickRandomFont();
    this.onFontChange(this._currentFont);

    await this._loadFont(this._currentFont);
    await this.setText(this._currentText);

    this._clock.start();
    this._tick();
  }

  /**
   * Sample `text` at the current font, rebuild particle geometry, and
   * transition to the FORMING state.  Safe to call from any state.
   *
   * @param {string} [text] – defaults to the last submitted text
   */
  async setText(text) {
    if (text !== undefined) this._currentText = text;
    this._pendingExplode = false;

    // Hide particles while rebuilding
    this._points.geometry.setDrawRange(0, 0);
    this._setState(S.IDLE);

    const font = this._currentFont;
    if (!font) return;

    const flatPos = await this._sampleText(this._currentText, font);
    if (flatPos.length === 0) {
      console.warn('[TextParticleEngine] No pixels sampled for:', this._currentText);
      return;
    }

    this._buildParticles(flatPos);
    this._setState(S.FORMING);
  }

  /**
   * Immediately trigger the explosion.
   * - In FORMED state  → starts EXPLODING right away.
   * - In FORMING state → defers until FORMED is reached.
   * - Otherwise        → no-op.
   */
  triggerExplosion() {
    if (this._state === S.FORMED) {
      this._beginExplosion();
    } else if (this._state === S.FORMING) {
      this._pendingExplode = true;
    }
  }

  /**
   * Pick a random font, reload the canvas raster, and restart.
   * @returns {Promise<string>} the name of the newly chosen font
   */
  async rerollFont() {
    const { pickRandomFont } = await import('./fonts.js');
    this._currentFont = pickRandomFont();
    this.onFontChange(this._currentFont);
    await this._loadFont(this._currentFont);
    await this.setText();
    return this._currentFont.name;
  }

  /**
   * Live-update runtime parameters.
   * If particleCount changes by more than 10%, geometry is rebuilt.
   *
   * @param {Object} cfg – { speed?, intensity?, particleCount? }
   */
  updateConfig(cfg) {
    const prevCount = this.cfg.particleCount;
    Object.assign(this.cfg, cfg);

    if (cfg.particleCount !== undefined &&
        Math.abs(cfg.particleCount - prevCount) > prevCount * 0.10) {
      this.setText(); // rebuild with new density
    }
  }

  /** @returns {'idle'|'forming'|'formed'|'exploding'|'vortex'|'done'} */
  getState() {
    return STATE_NAMES[this._state];
  }

  /** Release all WebGL resources and DOM listeners. */
  destroy() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    this._points.geometry.dispose();
    this._mat.dispose();
    this._renderer.dispose();
    this.mount.removeChild(this._renderer.domElement);
  }

  // ── State machine ─────────────────────────────────────────────────────────

  _setState(s) {
    this._state     = s;
    this._stateTime = 0;
    this.onStateChange(STATE_NAMES[s]);
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  _tick() {
    this._rafId = requestAnimationFrame(() => this._tick());
    const dt = Math.min(this._clock.getDelta(), 0.05); // cap at 50 ms
    if (this._state !== S.IDLE) this._update(dt);
    this._renderer.render(this._scene, this._camera);
  }

  _update(dt) {
    this._stateTime += dt;

    switch (this._state) {
      case S.FORMING:   this._updateForming(dt);   break;
      case S.FORMED:    this._updateFormed(dt);    break;
      case S.EXPLODING: this._updateExploding(dt); break;
      case S.VORTEX:    this._updateVortex(dt);    break;
      case S.DONE:      /* handled via setTimeout */  break;
    }

    // Upload changed arrays to GPU
    this._posAttr.needsUpdate = true;
    this._alAttr.needsUpdate  = true;
    this._szAttr.needsUpdate  = true;
    this._shAttr.needsUpdate  = true;
  }

  // FORMING — exponential ease toward text targets with gentle turbulence
  _updateForming(dt) {
    const lerpSpeed = 3.8 * this.cfg.speed;
    const t         = 1.0 - Math.exp(-lerpSpeed * dt); // frame-rate independent
    const elapsed   = this._clock.getElapsedTime();
    const turbAmp   = 0.022;

    for (let i = 0; i < this._count; i++) {
      const i3 = i * 3;
      const ph = this._ph[i];

      // Target with soft noise offset
      const tx = this._tgt[i3]   + Math.sin(elapsed * 2.0 + ph) * turbAmp;
      const ty = this._tgt[i3+1] + Math.cos(elapsed * 1.7 + ph * 1.3) * turbAmp;

      this._pos[i3]   += (tx - this._pos[i3])   * t;
      this._pos[i3+1] += (ty - this._pos[i3+1]) * t;
      this._pos[i3+2] += (this._tgt[i3+2] - this._pos[i3+2]) * t;

      // Fade in
      this._al[i] = Math.min(1.0, this._al[i] + dt * 2.5);
    }

    // Transition: enough time has passed to fully form
    const formDuration = 1.8 / this.cfg.speed;
    if (this._stateTime >= formDuration) {
      // Snap any stragglers
      for (let i = 0; i < this._count; i++) {
        const i3 = i * 3;
        this._pos[i3]   = this._tgt[i3];
        this._pos[i3+1] = this._tgt[i3+1];
        this._pos[i3+2] = this._tgt[i3+2];
        this._al[i]     = 1.0;
      }
      this._setState(S.FORMED);
      if (this._pendingExplode) {
        this._pendingExplode = false;
        this._beginExplosion();
      }
    }
  }

  // FORMED — gentle floating; auto-explode after hold duration
  _updateFormed(dt) {
    const elapsed  = this._clock.getElapsedTime();
    const floatAmp = 0.030;

    for (let i = 0; i < this._count; i++) {
      const i3 = i * 3;
      const ph = this._ph[i];
      // Sinusoidal vertical bob; X/Z stay at target
      this._pos[i3+1] = this._tgt[i3+1] + Math.sin(elapsed * 1.2 + ph) * floatAmp;
    }

    // Auto-trigger explosion
    const holdTime = 1.8 / this.cfg.speed;
    if (this._stateTime >= holdTime) {
      this._beginExplosion();
    }
  }

  // Begin explosion: assign per-particle velocities based on explosionMode
  _beginExplosion() {
    const mode  = this.preset.explosionMode || 'radial';
    const force = 5.0 * this.cfg.intensity;

    for (let i = 0; i < this._count; i++) {
      const i3  = i * 3;
      const x   = this._pos[i3];
      const y   = this._pos[i3 + 1];
      const z   = this._pos[i3 + 2];
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const ph  = this._ph[i];

      let vx, vy, vz, drag = 0.980 + Math.random() * 0.012;

      switch (mode) {

        // ── Radial: classic outward burst from text shape ──────────────────
        case 'radial':
        default: {
          const s = (0.6 + Math.random() * 1.6) * force;
          vx = (x / len * 0.65 + (Math.random() - 0.5) * 0.9) * s;
          vy = (y / len * 0.65 + (Math.random() - 0.5) * 0.9 + 0.25) * s;
          vz = (Math.random() - 0.5) * 0.55 * s;
          break;
        }

        // ── Upward: flames / rising smoke ─────────────────────────────────
        case 'upward': {
          vx   = (Math.random() - 0.5) * 2.5 * force;
          vy   = (0.6 + Math.random() * 1.5) * force;
          vz   = (Math.random() - 0.5) * 0.8 * force;
          drag = 0.972 + Math.random() * 0.01;
          break;
        }

        // ── Shatter: locked angular directions, like broken glass ──────────
        case 'shatter': {
          const sAngle = (Math.floor(ph * 6) / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
          const sSpeed = (0.8 + Math.random() * 1.4) * force;
          vx   = Math.cos(sAngle) * sSpeed;
          vy   = Math.sin(sAngle) * sSpeed * 0.85 + (Math.random() - 0.5) * force * 0.4;
          vz   = (Math.random() - 0.5) * 0.45 * force;
          drag = 0.962 + Math.random() * 0.009;
          break;
        }

        // ── Nuclear: extreme fast burst, rapid deceleration ────────────────
        case 'nuclear': {
          const s = (1.8 + Math.random() * 1.2) * force;
          vx   = (x / len + (Math.random() - 0.5) * 0.35) * s;
          vy   = (y / len + (Math.random() - 0.5) * 0.35) * s;
          vz   = (Math.random() - 0.5) * s * 0.5;
          drag = 0.948 + Math.random() * 0.015;
          break;
        }

        // ── Whirlwind: tangential + slight outward — particles spin out ────
        case 'whirlwind': {
          vx   = (-y / len * 0.85 + x / len * 0.35 + (Math.random() - 0.5) * 0.5) * force;
          vy   = ( x / len * 0.85 + y / len * 0.35 + (Math.random() - 0.5) * 0.5) * force * 0.75;
          vz   = (Math.random() - 0.5) * 0.45 * force;
          break;
        }

        // ── Fountain: shoot straight up, arc back under gravity ───────────
        case 'fountain': {
          vx   = (Math.random() - 0.5) * 1.8 * force;
          vy   = (0.9 + Math.random() * 2.0) * force;
          vz   = (Math.random() - 0.5) * 1.1 * force;
          drag = 0.990 + Math.random() * 0.005;
          break;
        }

        // ── Rain: cascade downward like heavy rain or falling leaves ───────
        case 'rain': {
          vx   = (Math.random() - 0.5) * 1.6 * force;
          vy   = -(0.5 + Math.random() * 1.5) * force;
          vz   = (Math.random() - 0.5) * 0.9 * force;
          drag = 0.990 + Math.random() * 0.006;
          break;
        }

        // ── Scatter: fully random 3D scatter in all directions ─────────────
        case 'scatter': {
          const rx = Math.random() - 0.5, ry = Math.random() - 0.5, rz = Math.random() - 0.5;
          const rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
          const s  = (0.5 + Math.random() * 1.8) * force;
          vx   = (rx / rl) * s;
          vy   = (ry / rl) * s;
          vz   = (rz / rl) * s;
          break;
        }

        // ── Wave: concentric rings expanding from text center ──────────────
        case 'wave': {
          const wDist = Math.sqrt(x * x + y * y) || 0.1;
          const wNorm = (0.7 + wDist * 0.15) * (0.8 + Math.random() * 0.6);
          vx   = (x / wDist) * force * wNorm;
          vy   = (y / wDist) * force * wNorm * 0.9;
          vz   = (Math.random() - 0.5) * 0.6 * force;
          drag = 0.978 + Math.random() * 0.012;
          break;
        }

        // ── Implode: particles collapse inward first, then drift apart ─────
        case 'implode': {
          vx   = -(x / len) * force * (0.5 + Math.random() * 0.9);
          vy   = -(y / len) * force * (0.5 + Math.random() * 0.9);
          vz   = (Math.random() - 0.5) * 0.3 * force;
          drag = 0.935 + Math.random() * 0.012; // extreme drag → stops fast
          break;
        }
      }

      this._vel[i3]     = vx;
      this._vel[i3 + 1] = vy;
      this._vel[i3 + 2] = vz;
      this._drag[i]     = drag;
    }

    this._setState(S.EXPLODING);
  }

  // EXPLODING — integrate velocity + per-mode gravity + drag
  _updateExploding(dt) {
    const speedMul = this.cfg.speed;
    const mode     = this.preset.explosionMode || 'radial';

    // Gravity varies by mode to complement each visual effect
    const GRAVITY = {
      radial:    -3.0,
      upward:    -9.0,   // flames rise then fall hard
      shatter:   -4.5,   // shards drop at medium rate
      nuclear:   -5.5,   // fast fragments drop quickly
      whirlwind: -1.8,   // spinning slows descent
      fountain:  -14.0,  // high arc + strong drop
      rain:       0.0,   // already going down, skip gravity
      scatter:   -2.0,   // gentle float
      wave:      -2.8,   // rings slow fall
      implode:   -0.8,   // weightless collapse
    };
    const gravity = GRAVITY[mode] ?? -3.0;

    for (let i = 0; i < this._count; i++) {
      const i3 = i * 3;
      const d  = this._drag[i];

      this._vel[i3 + 1] += gravity * dt;

      this._pos[i3]     += this._vel[i3]     * dt * speedMul;
      this._pos[i3 + 1] += this._vel[i3 + 1] * dt * speedMul;
      this._pos[i3 + 2] += this._vel[i3 + 2] * dt * speedMul;

      this._vel[i3]     *= d;
      this._vel[i3 + 1] *= d;
      this._vel[i3 + 2] *= d;
    }

    const explodeDuration = 1.4 / this.cfg.speed;
    if (this._stateTime >= explodeDuration) {
      // Initialise vortex polar coordinates from current positions
      for (let i = 0; i < this._count; i++) {
        const i3 = i * 3;
        const x = this._pos[i3];
        const z = this._pos[i3+2];
        this._pr[i] = Math.sqrt(x * x + z * z) + 0.3; // small offset avoids singularity
        this._pa[i] = Math.atan2(z, x);
      }
      this._setState(S.VORTEX);
    }
  }

  // VORTEX — polar-coordinate spiral inward; angular velocity increases as radius shrinks
  _updateVortex(dt) {
    const inRate    = 0.55 * this.cfg.intensity;
    const spinDir   = this.preset.vortexCCW ? -1 : 1;  // clockwise or counter-clockwise
    const baseOmega = (2.8 + this.preset.vortexRadius * 0.25) * this.cfg.speed * spinDir;
    const decay     = Math.exp(-inRate * dt);

    let alive = 0;

    for (let i = 0; i < this._count; i++) {
      if (this._al[i] < 0.005) continue;
      alive++;

      const i3 = i * 3;

      // Spiral inward (geometric decay per frame)
      this._pr[i] *= decay;

      // Angular velocity: inversely proportional to radius (conservation-like)
      const omega = baseOmega * (1.0 + 2.0 / (this._pr[i] + 0.4));
      this._pa[i] += omega * dt;

      // Back to Cartesian (XZ plane)
      this._pos[i3]   = Math.cos(this._pa[i]) * this._pr[i];
      this._pos[i3+2] = Math.sin(this._pa[i]) * this._pr[i];

      // Dampen Y toward 0
      this._pos[i3+1] *= Math.exp(-2.0 * dt);

      // Fade alpha proportional to radius, accelerating near centre
      const frac      = Math.min(1, this._pr[i] / 2.0);
      this._al[i]     = frac * frac; // quadratic — faster fade near centre

      // Shrink particle size
      this._sz[i] = Math.max(0, this._sz[i] - this._baseSz[i] * dt * 0.6);
    }

    this._szAttr.needsUpdate = true;

    // Done when all faded OR time limit exceeded
    const vortexDuration = 3.8 / this.cfg.speed;
    if (alive === 0 || this._stateTime >= vortexDuration) {
      this._setState(S.DONE);
      // Auto-restart after a brief pause
      setTimeout(() => {
        if (this._state === S.DONE) this.setText();
      }, 1800);
    }
  }

  // ── Text rasterisation ────────────────────────────────────────────────────

  /**
   * Draw `text` on an off-screen canvas, sample lit pixels, and return a
   * flat Float32Array of [x0,y0,z0, x1,y1,z1, …] world-space positions.
   */
  async _sampleText(text, font) {
    // Ensure the font glyphs are actually rendered (not just CSS-registered)
    await document.fonts.load(`${font.weight} 200px ${font.css}`);
    // Small settle delay; some browsers need a microtask after font load
    await new Promise(r => setTimeout(r, 40));

    const W = 1200, H = 300;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Auto-size: shrink until text fits with margin
    let fontSize = 230;
    ctx.font = `${font.weight} ${fontSize}px ${font.css}`;
    while (ctx.measureText(text).width > W - 80 && fontSize > 16) {
      fontSize -= 3;
      ctx.font = `${font.weight} ${fontSize}px ${font.css}`;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, W / 2, H / 2);

    // Sample every `step` pixels; step chosen to approximate target particle count
    const targetCount = Math.min(this.cfg.particleCount, MAX);
    const imgData     = ctx.getImageData(0, 0, W, H).data;

    // First pass: collect all lit pixel coords
    const litX = [], litY = [];
    const step  = 3;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (imgData[(y * W + x) * 4] > 64) {
          litX.push(x);
          litY.push(y);
        }
      }
    }

    const litCount = litX.length;
    if (litCount === 0) return new Float32Array(0);

    // Reservoir-sample to targetCount
    const out      = new Float32Array(targetCount * 3);
    const ratio    = litCount / targetCount;
    let   written  = 0;

    for (let i = 0; i < litCount && written < targetCount; i++) {
      if (Math.random() < 1.0 / ratio || written === 0) {
        const base = written * 3;
        out[base]   =  (litX[i] / W - 0.5) * 10.0;  // x: [-5, +5]
        out[base+1] = -(litY[i] / H - 0.5) * 2.5;   // y: [-1.25, +1.25]
        out[base+2] =  0;
        written++;
      }
    }

    return out.subarray(0, written * 3);
  }

  // ── Geometry construction ─────────────────────────────────────────────────

  /**
   * Initialise all per-particle arrays from `flatPos` (output of _sampleText)
   * and set the draw range.  Called every time text or particle count changes.
   */
  _buildParticles(flatPos) {
    const count  = flatPos.length / 3;
    this._count  = count;

    const paletteColors = this.preset.colors.map(h => new THREE.Color(h));
    const nc             = paletteColors.length;

    for (let i = 0; i < count; i++) {
      const i3  = i * 3;
      const fp  = i * 3;

      // Target (text pixel)
      this._tgt[i3]   = flatPos[fp];
      this._tgt[i3+1] = flatPos[fp+1];
      this._tgt[i3+2] = flatPos[fp+2];

      // Spawn position: scattered off-screen in a ring
      const angle       = Math.random() * Math.PI * 2;
      const spawnRadius = 12 + Math.random() * 8;
      this._pos[i3]   = Math.cos(angle) * spawnRadius;
      this._pos[i3+1] = (Math.random() - 0.5) * 12;
      this._pos[i3+2] = Math.sin(angle) * spawnRadius * 0.15 - 0.5;

      // Velocity zeroed
      this._vel[i3] = this._vel[i3+1] = this._vel[i3+2] = 0;

      // Colour: cycle through palette with per-particle variation
      const c  = paletteColors[i % nc];
      const jit = 0.06;
      this._col[i3]   = THREE.MathUtils.clamp(c.r + (Math.random()-0.5)*jit, 0, 1);
      this._col[i3+1] = THREE.MathUtils.clamp(c.g + (Math.random()-0.5)*jit, 0, 1);
      this._col[i3+2] = THREE.MathUtils.clamp(c.b + (Math.random()-0.5)*jit, 0, 1);

      // Size (larger, more readable at a glance)
      const sz = 0.10 + Math.random() * 0.24;
      this._sz[i]      = sz;
      this._baseSz[i]  = sz;

      // Shape mix: mostly circles/triangles with some angular accents
      const r = Math.random();
      this._sh[i] =
        r < 0.34 ? 0.0 : // circle
        r < 0.62 ? 1.0 : // triangle
        r < 0.80 ? 2.0 : // square
        r < 0.93 ? 3.0 : // diamond
                   4.0;  // hex

      // Start invisible; fade in during FORMING
      this._al[i] = 0;

      // Random phase (used for turbulence and float)
      this._ph[i]   = Math.random() * Math.PI * 2;
      this._drag[i] = 0.985;
    }

    this._points.geometry.setDrawRange(0, count);

    // Mark all attributes dirty for this frame's upload
    this._posAttr.needsUpdate = true;
    this._colAttr.needsUpdate = true;
    this._szAttr.needsUpdate  = true;
    this._alAttr.needsUpdate  = true;
    this._shAttr.needsUpdate  = true;
  }

  // ── Font loading ──────────────────────────────────────────────────────────

  /** Wait for a specific font to be rasterisable in canvas 2D contexts. */
  async _loadFont(font) {
    if (font.system) return; // system fonts are always available
    try {
      await document.fonts.load(`${font.weight} 200px ${font.css}`);
    } catch (e) {
      console.warn('[TextParticleEngine] Font load failed:', font.name, e);
    }
    await new Promise(r => setTimeout(r, 60)); // brief settle
  }
}
