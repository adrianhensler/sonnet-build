/**
 * fonts.js
 * Curated font list for the Text Particle engine.
 *
 * System fonts are available immediately (no network required).
 * Google Fonts are loaded dynamically via a <link> injection; the
 * loadAllGoogleFonts() helper returns a Promise that resolves when
 * the font-face CSS has been parsed by the browser.
 *
 * The engine uses document.fonts.load() per-font before canvas sampling
 * to ensure glyphs are actually rasterised, not just CSS-registered.
 */

export const FONTS = [
  // ── System fonts (always available, no network) ──────────────────────────
  {
    name: 'Arial Black',
    css:  "'Arial Black', Gadget, sans-serif",
    weight: 900,
    system: true,
  },
  {
    name: 'Impact',
    css:  "Impact, Charcoal, sans-serif",
    weight: 400,
    system: true,
  },
  {
    name: 'Georgia Bold',
    css:  "Georgia, 'Times New Roman', serif",
    weight: 700,
    system: true,
  },
  {
    name: 'Trebuchet MS',
    css:  "'Trebuchet MS', Helvetica, sans-serif",
    weight: 700,
    system: true,
  },
  {
    name: 'Courier New',
    css:  "'Courier New', Courier, monospace",
    weight: 700,
    system: true,
  },

  // ── Google Fonts (loaded via CDN, requires internet) ─────────────────────
  {
    name: 'Oswald',
    css:  "'Oswald', sans-serif",
    weight: 700,
    system: false,
    gfamily: 'Oswald:wght@700',
  },
  {
    name: 'Bebas Neue',
    css:  "'Bebas Neue', cursive",
    weight: 400,
    system: false,
    gfamily: 'Bebas+Neue',
  },
  {
    name: 'Righteous',
    css:  "'Righteous', cursive",
    weight: 400,
    system: false,
    gfamily: 'Righteous',
  },
  {
    name: 'Russo One',
    css:  "'Russo One', sans-serif",
    weight: 400,
    system: false,
    gfamily: 'Russo+One',
  },
  {
    name: 'Bangers',
    css:  "'Bangers', cursive",
    weight: 400,
    system: false,
    gfamily: 'Bangers',
  },
  {
    name: 'Orbitron',
    css:  "'Orbitron', sans-serif",
    weight: 700,
    system: false,
    gfamily: 'Orbitron:wght@700',
  },
  {
    name: 'Exo 2',
    css:  "'Exo 2', sans-serif",
    weight: 800,
    system: false,
    gfamily: 'Exo+2:wght@800',
  },
  {
    name: 'Black Han Sans',
    css:  "'Black Han Sans', sans-serif",
    weight: 400,
    system: false,
    gfamily: 'Black+Han+Sans',
  },
  {
    name: 'Teko',
    css:  "'Teko', sans-serif",
    weight: 600,
    system: false,
    gfamily: 'Teko:wght@600',
  },
  {
    name: 'Alfa Slab One',
    css:  "'Alfa Slab One', cursive",
    weight: 400,
    system: false,
    gfamily: 'Alfa+Slab+One',
  },
  {
    name: 'Bungee',
    css:  "'Bungee', cursive",
    weight: 400,
    system: false,
    gfamily: 'Bungee',
  },
  {
    name: 'Press Start 2P',
    css:  "'Press Start 2P', cursive",
    weight: 400,
    system: false,
    gfamily: 'Press+Start+2P',
  },
  {
    name: 'Black Ops One',
    css:  "'Black Ops One', cursive",
    weight: 400,
    system: false,
    gfamily: 'Black+Ops+One',
  },
  {
    name: 'Monoton',
    css:  "'Monoton', cursive",
    weight: 400,
    system: false,
    gfamily: 'Monoton',
  },
  {
    name: 'Fredoka',
    css:  "'Fredoka', sans-serif",
    weight: 700,
    system: false,
    gfamily: 'Fredoka:wght@700',
  },
];

/**
 * Inject a single Google Fonts <link> for all non-system fonts and return
 * a Promise that resolves once the browser has parsed the CSS.
 *
 * Call this once during app init.  Safe to call multiple times (subsequent
 * calls are no-ops if the link is already in the <head>).
 */
export async function loadAllGoogleFonts() {
  if (document.getElementById('gfonts-link')) return; // already injected

  const families = FONTS
    .filter(f => !f.system)
    .map(f => f.gfamily)
    .join('&family=');

  const link = document.createElement('link');
  link.id   = 'gfonts-link';
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);

  // Wait for the stylesheet to be parsed
  return new Promise(resolve => {
    link.addEventListener('load', resolve);
    link.addEventListener('error', resolve); // resolve even on failure so we degrade gracefully
    // Timeout fallback in case the event never fires
    setTimeout(resolve, 3000);
  });
}

/**
 * Pick a random font from the FONTS array.
 * @returns {Object} font descriptor
 */
export function pickRandomFont() {
  return FONTS[Math.floor(Math.random() * FONTS.length)];
}
