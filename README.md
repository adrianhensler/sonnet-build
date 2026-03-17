# Text Particle Gallery

A fully self-contained static Three.js project that renders any phrase as a
particle cloud, then explodes it into one of 10 distinct vortex patterns.
Twenty curated presets cover the full spectrum — fire, ice storms, glass
shards, fountains, orbital mechanics, and more.

---

## Quick start

Because the demo uses ES modules and an `importmap`, browsers block them when
opened as a `file://` URL.  You need to serve the directory over HTTP.

### Option 1 — Python (no install)

```bash
cd /path/to/sonnet-build
python3 -m http.server 8080
```

Then open **http://localhost:8080** in any modern browser.

### Option 2 — Node / npx (no install)

```bash
cd /path/to/sonnet-build
npx serve .
# or
npx http-server . -p 8080
```

### Option 3 — VS Code Live Server

Install the *Live Server* extension, right-click `index.html` → **Open with
Live Server**.

---

## File structure

```
sonnet-build/
├── index.html          Gallery — 20 preset cards, each links to the demo
├── demo.html           Interactive demo — controls + live Three.js canvas
├── README.md           This file
└── js/
    ├── engine.js       TextParticleEngine — Three.js particle renderer
    │                   State machine: FORMING → FORMED → EXPLODING → VORTEX
    │                   10 explosion modes (radial, upward, shatter, nuclear,
    │                   whirlwind, fountain, rain, scatter, wave, implode)
    ├── presets.js      20 named presets with colours, physics & effect mode
    ├── fonts.js        20 curated fonts (5 system + 15 Google Fonts)
    ├── gallery.js      Builds the index.html card grid from presets data
    └── demo.js         Wires all demo.html controls to TextParticleEngine
```

---

## Controls (demo page)

| Control | What it does |
|---|---|
| **Text field** | Type any phrase (max 24 chars); press Enter or click *Fire* |
| **Fire** | Re-sample text at current font and restart animation |
| **Explode** | Trigger the explosion immediately (skips hold phase) |
| **Font dropdown** | Pick any of the 20 curated display fonts |
| **↺ (random font)** | Roll a random font and reload |
| **Speed slider** | 0.3 – 2.5 × — controls formation and explosion timing |
| **Intensity slider** | 0.3 – 2.5 × — controls explosion force and vortex pull |
| **Particles slider** | 300 – 6 000 live particles |
| **Canvas click** | Triggers explosion while text is fully formed |

---

## Explosion modes (one per preset family)

| Mode | Visual character |
|---|---|
| `radial` | Classic outward burst following text shape |
| `upward` | Particles rise like flames or smoke |
| `shatter` | Locked angular directions — breaking glass |
| `nuclear` | Extreme-speed burst with rapid deceleration |
| `whirlwind` | Tangential launch creates a spinning fan |
| `fountain` | High arc upward, strong gravity pulls back down |
| `rain` | Cascade downward like heavy rain or falling leaves |
| `scatter` | Fully random 3-D directions — cosmic debris |
| `wave` | Concentric rings ripple outward from text centre |
| `implode` | Particles collapse inward first, then dissipate |

---

## Adding your own preset

Edit `js/presets.js`, duplicate an existing entry, and change:

- `id` — unique integer
- `name` / `defaultText` — display strings
- `background` — hex scene background
- `colors` — array of hex particle colours (cycled with per-particle jitter)
- `explosionMode` — one of the 10 modes listed above
- `vortexCCW` — `true` for counter-clockwise vortex spin
- `speed` / `intensity` — physics multipliers

No build step required.

---

## Browser compatibility

Requires a browser with `importmap` support (Chrome 89+, Firefox 108+, Safari
16.4+).  Three.js r160 and all Google Fonts are loaded from CDN; an internet
connection is needed on first load.
