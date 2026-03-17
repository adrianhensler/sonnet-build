/**
 * gallery.js
 * Entry-point script for index.html.
 * Dynamically builds the 20-card preset grid from presets.js data.
 */

import { PRESETS } from './presets.js';

const grid = document.getElementById('preset-grid');

PRESETS.forEach(preset => {
  const a = document.createElement('a');
  a.className = 'preset-card';
  a.href      = `demo.html?preset=${preset.id}`;
  a.setAttribute('aria-label', `Open preset: ${preset.name}`);

  // Colour swatches (one dot per palette colour)
  const swatches = preset.colors
    .map(c => `<span class="swatch" style="background:${c}"></span>`)
    .join('');

  a.innerHTML = `
    <span class="card-num">${String(preset.id).padStart(2, '0')}</span>
    <strong class="card-name">${preset.name}</strong>
    <span class="card-text">${preset.defaultText}</span>
    <span class="card-swatches">${swatches}</span>
  `;

  grid.appendChild(a);
});
