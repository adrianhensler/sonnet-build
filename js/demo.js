/**
 * demo.js
 * Entry-point script for demo.html.
 *
 * Responsibilities
 * ────────────────
 *   • Parse ?preset=N from the URL and look up the matching preset.
 *   • Load Google Fonts, initialise TextParticleEngine, auto-launch.
 *   • Wire up all UI controls (text input, font roller, sliders, buttons).
 *   • Keep the status display up-to-date.
 */

import { PRESETS }                          from './presets.js';
import { FONTS, loadAllGoogleFonts }        from './fonts.js';
import { TextParticleEngine }               from './engine.js';

// ── Resolve preset from URL ───────────────────────────────────────────────────

const params  = new URLSearchParams(location.search);
const presetId = Number(params.get('preset')) || 1;
const preset   = PRESETS.find(p => p.id === presetId) ?? PRESETS[0];

// ── DOM references ────────────────────────────────────────────────────────────

const mount          = document.getElementById('scene-mount');
const presetNameEl   = document.getElementById('preset-name');
const phraseInput    = document.getElementById('phrase-input');
const fontNameEl     = document.getElementById('font-name');
const stateNameEl    = document.getElementById('state-name');
const speedInput     = document.getElementById('speed-input');
const speedValue     = document.getElementById('speed-value');
const intensityInput = document.getElementById('intensity-input');
const intensityValue = document.getElementById('intensity-value');
const countInput     = document.getElementById('count-input');
const countValue     = document.getElementById('count-value');
const btnFire        = document.getElementById('btn-fire');
const btnReroll      = document.getElementById('btn-reroll');
const btnExplode     = document.getElementById('btn-explode');
const fontSelect     = document.getElementById('font-select');
const fontNameLabel  = document.getElementById('font-name-label');
const hintEl         = document.getElementById('hint');

// ── Page setup ────────────────────────────────────────────────────────────────

document.title = `${preset.name} — Text Particle Gallery`;
presetNameEl.textContent = `${String(preset.id).padStart(2,'0')}. ${preset.name}`;
phraseInput.value        = preset.defaultText;

// Populate font <select> from FONTS list
FONTS.forEach((font, idx) => {
  const opt = document.createElement('option');
  opt.value       = idx;
  opt.textContent = font.name;
  fontSelect.appendChild(opt);
});

// Initialise slider values from preset defaults
speedInput.value     = preset.speed;
intensityInput.value = preset.intensity;
countInput.value     = preset.particleCount;
updateSliderLabels();

// ── Engine ────────────────────────────────────────────────────────────────────

let engine = null;

async function boot() {
  // Load Google Fonts (non-blocking for system fonts)
  await loadAllGoogleFonts();

  engine = new TextParticleEngine({
    mount,
    preset,
    onStateChange(stateName) {
      stateNameEl.textContent = stateName;

      // Show "click to explode" hint only while text is fully formed
      if (hintEl) {
        hintEl.style.opacity = stateName === 'formed' ? '1' : '0';
      }
    },
    onFontChange(font) {
      fontNameEl.textContent = font.name;
      if (fontNameLabel) fontNameLabel.textContent = font.name;
      // Sync the <select> to show the current font
      const idx = FONTS.findIndex(f => f.name === font.name);
      if (idx !== -1 && fontSelect) fontSelect.value = idx;
    },
  });

  await engine.init();
}

boot().catch(err => console.error('[demo] boot failed:', err));

// ── UI helpers ────────────────────────────────────────────────────────────────

function updateSliderLabels() {
  speedValue.textContent     = Number(speedInput.value).toFixed(2);
  intensityValue.textContent = Number(intensityInput.value).toFixed(2);
  countValue.textContent     = Number(countInput.value).toLocaleString();
}

function syncConfig() {
  updateSliderLabels();
  if (!engine) return;
  engine.updateConfig({
    speed:         Number(speedInput.value),
    intensity:     Number(intensityInput.value),
    particleCount: Number(countInput.value),
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

speedInput.addEventListener('input', syncConfig);
intensityInput.addEventListener('input', syncConfig);
countInput.addEventListener('input', syncConfig);

btnFire.addEventListener('click', () => {
  if (!engine) return;
  engine.setText(phraseInput.value.trim() || preset.defaultText);
});

btnReroll.addEventListener('click', async () => {
  if (!engine) return;
  btnReroll.disabled = true;
  await engine.rerollFont();
  btnReroll.disabled = false;
});

// Font <select>: pick a specific font by index
fontSelect?.addEventListener('change', async () => {
  if (!engine) return;
  const idx  = Number(fontSelect.value);
  const font = FONTS[idx];
  if (!font) return;
  fontSelect.disabled = true;
  // Patch the engine's current font directly then reload text
  engine._currentFont = font;
  engine.onFontChange(font);
  await engine.setText();
  fontSelect.disabled = false;
});

btnExplode.addEventListener('click', () => {
  if (!engine) return;
  engine.triggerExplosion();
});

// Click/tap the canvas → immediate explosion
mount.addEventListener('click', () => {
  if (!engine) return;
  engine.triggerExplosion();
});

// Enter key in text field → re-fire
phraseInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (!engine) return;
  engine.setText(phraseInput.value.trim() || preset.defaultText);
});

// Random-text helper: capitalise random English word for demo flavour
const demoWords = [
  'EXPLODE', 'VORTEX', 'IGNITE', 'COSMOS', 'INFERNO', 'PRISM',
  'FRACTAL', 'QUANTUM', 'NEBULA', 'RADIANT', 'SURGE', 'ECLIPSE',
  'NOVA', 'FLUX', 'ZENITH', 'CHAOS', 'SPARK', 'ABYSS', 'BLAZE', 'DRIFT',
];
document.getElementById('btn-random')?.addEventListener('click', () => {
  const word = demoWords[Math.floor(Math.random() * demoWords.length)];
  phraseInput.value = word;
  if (!engine) return;
  engine.setText(word);
});
