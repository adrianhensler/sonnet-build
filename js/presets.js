/**
 * presets.js
 * 20 visual preset configurations for the Text Particle engine.
 *
 * Each preset defines the colour palette, physics tuning, and default text
 * for one of the gallery entries.  The engine reads these at runtime — you
 * can tweak any value here without touching the engine code.
 *
 * Fields
 * ------
 * id             – 1-based index used in the demo URL (?preset=N)
 * name           – display name shown in the gallery card and demo header
 * defaultText    – word shown when the demo first loads
 * background     – CSS hex for the scene background
 * colors         – array of hex strings; particles are coloured by cycling
 *                  through this array with a slight per-particle jitter
 * particleCount  – target number of live particles (capped at engine MAX)
 * speed          – base multiplier for formation / explosion timing (1 = default)
 * intensity      – base multiplier for explosion force and vortex pull (1 = default)
 * vortexRadius   – reference radius used to tune rotational speed in the vortex phase
 */

export const PRESETS = [
  {
    id: 1,
    name: 'Neon Reactor',
    defaultText: 'REACTOR',
    background: '#030b12',
    colors: ['#00d9ff', '#66f2ff', '#a0f8ff', '#ffffff'],
    particleCount: 2800,
    speed: 1.00,
    intensity: 1.10,
    vortexRadius: 4.2,
    explosionMode: 'shatter',   // cyan glass shards fly apart at locked angles
    vortexCCW: false,
  },
  {
    id: 2,
    name: 'Solar Flare',
    defaultText: 'FLARE',
    background: '#110500',
    colors: ['#ff7b00', '#ffb833', '#ffd37a', '#ff3300'],
    particleCount: 3200,
    speed: 1.25,
    intensity: 1.40,
    vortexRadius: 3.6,
    explosionMode: 'upward',    // fire / flames shooting skyward
    vortexCCW: false,
  },
  {
    id: 3,
    name: 'Aurora Mist',
    defaultText: 'AURORA',
    background: '#03100e',
    colors: ['#35ffaf', '#b2ffd7', '#00e5cc', '#00bfff'],
    particleCount: 2600,
    speed: 0.85,
    intensity: 0.95,
    vortexRadius: 5.4,
    explosionMode: 'wave',      // ripple rings expand from text centre
    vortexCCW: true,
  },
  {
    id: 4,
    name: 'Cosmic Grape',
    defaultText: 'COSMOS',
    background: '#08020f',
    colors: ['#9f6bff', '#e4c5ff', '#bf88ff', '#5e00cc'],
    particleCount: 3000,
    speed: 1.10,
    intensity: 1.20,
    vortexRadius: 4.1,
    explosionMode: 'scatter',   // stars scatter in all 3D directions
    vortexCCW: true,
  },
  {
    id: 5,
    name: 'Mint Pulse',
    defaultText: 'PULSE',
    background: '#021209',
    colors: ['#39ff9e', '#d1ffe6', '#00e57a', '#84ffcc'],
    particleCount: 2400,
    speed: 0.90,
    intensity: 1.00,
    vortexRadius: 5.8,
    explosionMode: 'radial',    // clean radial burst, classic
    vortexCCW: false,
  },
  {
    id: 6,
    name: 'Crimson Core',
    defaultText: 'IGNITE',
    background: '#0f0000',
    colors: ['#ff3e4f', '#ffc9cb', '#ff6b78', '#cc0011'],
    particleCount: 3500,
    speed: 1.35,
    intensity: 1.45,
    vortexRadius: 3.3,
    explosionMode: 'nuclear',   // extreme fast burst, rapid decay
    vortexCCW: false,
  },
  {
    id: 7,
    name: 'Ocean Current',
    defaultText: 'CURRENT',
    background: '#01060f',
    colors: ['#3ea8ff', '#cce6ff', '#6dc4ff', '#005fcc'],
    particleCount: 3000,
    speed: 1.05,
    intensity: 1.10,
    vortexRadius: 4.9,
    explosionMode: 'wave',      // concentric ocean-like ripples
    vortexCCW: true,
  },
  {
    id: 8,
    name: 'Golden Spiral',
    defaultText: 'SPIRAL',
    background: '#0d0800',
    colors: ['#ffc642', '#ffe9b0', '#ffda80', '#e07b00'],
    particleCount: 2900,
    speed: 1.15,
    intensity: 1.20,
    vortexRadius: 4.0,
    explosionMode: 'whirlwind', // tangential spin creates golden swirl
    vortexCCW: false,
  },
  {
    id: 9,
    name: 'Ice Storm',
    defaultText: 'STORM',
    background: '#010810',
    colors: ['#7edbff', '#d9f2ff', '#b3ecff', '#3399cc'],
    particleCount: 3200,
    speed: 1.00,
    intensity: 1.05,
    vortexRadius: 4.7,
    explosionMode: 'scatter',   // chaotic ice-crystal scatter
    vortexCCW: false,
  },
  {
    id: 10,
    name: 'Magenta Warp',
    defaultText: 'WARP',
    background: '#0e000e',
    colors: ['#ff4fd6', '#ffd4f4', '#ff80e8', '#aa00aa'],
    particleCount: 3300,
    speed: 1.28,
    intensity: 1.35,
    vortexRadius: 3.9,
    explosionMode: 'implode',   // particles collapse inward first
    vortexCCW: true,
  },
  {
    id: 11,
    name: 'Forest Drift',
    defaultText: 'DRIFT',
    background: '#020c02',
    colors: ['#6bff4f', '#d7ffd3', '#a0ff84', '#228b22'],
    particleCount: 2300,
    speed: 0.82,
    intensity: 0.90,
    vortexRadius: 6.0,
    explosionMode: 'rain',      // leaves drifting slowly downward
    vortexCCW: true,
  },
  {
    id: 12,
    name: 'Ultraviolet Arc',
    defaultText: 'ARC',
    background: '#04000f',
    colors: ['#7f54ff', '#d7c9ff', '#a688ff', '#3300aa'],
    particleCount: 3400,
    speed: 1.18,
    intensity: 1.30,
    vortexRadius: 3.5,
    explosionMode: 'shatter',   // UV glass shards in angular directions
    vortexCCW: true,
  },
  {
    id: 13,
    name: 'Rose Nebula',
    defaultText: 'NEBULA',
    background: '#0f010a',
    colors: ['#ff5f87', '#ffd8e1', '#ff8aaa', '#cc003d'],
    particleCount: 2800,
    speed: 1.02,
    intensity: 1.10,
    vortexRadius: 4.6,
    explosionMode: 'fountain',  // rose petals arc upward and fall back
    vortexCCW: false,
  },
  {
    id: 14,
    name: 'Steel Orbit',
    defaultText: 'ORBIT',
    background: '#060810',
    colors: ['#9aa4b3', '#e6edf3', '#c8d4e0', '#4a5568'],
    particleCount: 2700,
    speed: 0.95,
    intensity: 1.00,
    vortexRadius: 5.0,
    explosionMode: 'whirlwind', // orbital mechanics spin-out
    vortexCCW: true,
  },
  {
    id: 15,
    name: 'Amber Cyclone',
    defaultText: 'CYCLONE',
    background: '#0d0500',
    colors: ['#ff9a3d', '#ffe1be', '#ffb86a', '#cc5500'],
    particleCount: 3100,
    speed: 1.22,
    intensity: 1.25,
    vortexRadius: 4.1,
    explosionMode: 'nuclear',   // cyclone burst, extreme then tight vortex
    vortexCCW: false,
  },
  {
    id: 16,
    name: 'Cyber Mint',
    defaultText: 'CYBER',
    background: '#01100d',
    colors: ['#27ffc3', '#c4ffef', '#60ffd7', '#009977'],
    particleCount: 2950,
    speed: 1.12,
    intensity: 1.18,
    vortexRadius: 4.4,
    explosionMode: 'upward',    // data stream rising like cyber code
    vortexCCW: true,
  },
  {
    id: 17,
    name: 'Midnight Wave',
    defaultText: 'MIDNIGHT',
    background: '#000510',
    colors: ['#5f7cff', '#ced8ff', '#8fa5ff', '#001177'],
    particleCount: 2500,
    speed: 0.88,
    intensity: 0.96,
    vortexRadius: 5.5,
    explosionMode: 'wave',      // deep ocean wave pulse
    vortexCCW: false,
  },
  {
    id: 18,
    name: 'Lime Shock',
    defaultText: 'SHOCK',
    background: '#060a00',
    colors: ['#b3ff26', '#e8ffbf', '#ccff55', '#558800'],
    particleCount: 3600,
    speed: 1.30,
    intensity: 1.40,
    vortexRadius: 3.2,
    explosionMode: 'nuclear',   // electric shock — fastest burst
    vortexCCW: true,
  },
  {
    id: 19,
    name: 'Frost Violet',
    defaultText: 'FROST',
    background: '#060415',
    colors: ['#a296ff', '#e9e4ff', '#c4bcff', '#4422aa'],
    particleCount: 3050,
    speed: 1.06,
    intensity: 1.16,
    vortexRadius: 4.3,
    explosionMode: 'fountain',  // frost crystals arc gracefully up
    vortexCCW: true,
  },
  {
    id: 20,
    name: 'Sunset Ember',
    defaultText: 'EMBER',
    background: '#0e0300',
    colors: ['#ff6f52', '#ffe0cf', '#ff9475', '#aa2200'],
    particleCount: 3150,
    speed: 1.16,
    intensity: 1.28,
    vortexRadius: 4.0,
    explosionMode: 'upward',    // embers drifting skyward on heat
    vortexCCW: false,
  },
];
