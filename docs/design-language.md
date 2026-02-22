# BeeBuddy Design Language

> A unified visual system for web (Astro) and mobile (Expo/React Native).
> Rooted in the geometry of the honeycomb and the tech-nature fusion of the BeeBuddy logo.

---

## 1. Design Philosophy

**"Smart Hive"** — where nature's engineering meets modern technology.

The BeeBuddy logo tells this story: a bee silhouette embedded in a microchip, circuit traces reaching outward like a living network. The design language extends this metaphor:

- **Hexagonal geometry** replaces circles and rounded rectangles as the primary shape language. Honeycombs are nature's most efficient structure — they communicate precision, organization, and natural intelligence.
- **Circuit traces** appear as subtle connecting lines, progress indicators, and decorative elements — reinforcing the AI/tech layer.
- **Organic warmth** over cold tech. Even though BeeBuddy is data-driven, it serves people who work with living things. The palette, typography, and spacing should feel warm, grounded, and approachable.

---

## 2. Color System

### Primary Palette

| Token              | Hex       | Usage                                        |
| ------------------- | --------- | -------------------------------------------- |
| `honey`            | `#fdbc48` | Primary actions, highlights, active states    |
| `forest`           | `#3f4a30` | Primary text, headers, nav backgrounds        |

### Extended Palette

Derived from the primaries to cover all UI needs.

| Token              | Hex       | Derivation          | Usage                                    |
| ------------------- | --------- | ------------------- | ---------------------------------------- |
| `honey-light`      | `#fee8b6` | honey @ 30% tint    | Hover backgrounds, selected row fills     |
| `honey-pale`       | `#fff7e5` | honey @ 12% tint    | Page backgrounds, card fills              |
| `honey-dark`       | `#946000` | honey darkened       | Pressed states, honey text on light bg (5.1:1 on white) |
| `forest-light`     | `#5c6b47` | forest lightened 20%| Secondary text, subtle borders            |
| `forest-pale`      | `#eef0eb` | forest @ 8% tint    | Alternate row backgrounds, sidebar bg     |
| `forest-dark`      | `#2b331f` | forest darkened 20% | Deep backgrounds, modal overlays          |
| `comb-white`       | `#fafaf7` | Warm white           | Default page background                  |
| `comb-cream`       | `#f5f2ea` | Warm off-white       | Card backgrounds, input fields            |

### Semantic Colors

All semantic colors are verified to meet WCAG AA (4.5:1) against `comb-white`.

| Token              | Hex       | Ratio vs white | Usage                                |
| ------------------- | --------- | -------------- | ------------------------------------ |
| `success`          | `#4a7c3f` | 4.7:1 AA       | Healthy hive, positive status        |
| `warning`          | `#8b5a00` | 5.6:1 AA       | Attention needed, moderate alerts    |
| `danger`           | `#c0392b` | 5.2:1 AA       | Critical alerts, destructive actions |
| `info`             | `#3b638a` | 6.0:1 AA       | Informational badges, help text      |

**Note:** `warning` and `info` were darkened from earlier drafts (`#e8961e`, `#5b7fa5`) because the original values failed WCAG AA contrast on light backgrounds.

### Dark Mode

| Token              | Light       | Dark          |
| ------------------- | ----------- | ------------- |
| `bg-primary`       | `#fafaf7`  | `#1a1e15`     |
| `bg-surface`       | `#f5f2ea`  | `#252b1e`     |
| `bg-elevated`      | `#ffffff`  | `#2f3727`     |
| `text-primary`     | `#3f4a30`  | `#f5f2ea`     |
| `text-secondary`   | `#5c6b47`  | `#b3b99f`     |
| `border`           | `#ddd8cc`  | `#3f4a30`     |
| `honey`            | `#fdbc48`  | `#fdbc48`     |

Honey stays constant across modes — it's the brand anchor.

---

## 3. Typography

### Font Stack

| Role        | Font                        | Fallback                              | License   |
| ----------- | --------------------------- | ------------------------------------- | --------- |
| **Display** | `"Plus Jakarta Sans"`       | `system-ui`, `sans-serif`             | OFL       |
| **Body**    | `"Inter"`                   | `system-ui, sans-serif`               | OFL       |
| **Mono**    | `"JetBrains Mono"`          | `ui-monospace, monospace`             | OFL       |
| **Logo**    | `"Norwester"`               | `"Plus Jakarta Sans"`, `system-ui`    | OFL       |

**Why Plus Jakarta Sans for display:** A geometric sans-serif with good weight range (600-800 for headers). Clean, modern, and readable at all sizes including lowercase — unlike Norwester which is uppercase-only.

**Norwester is logo-only:** The logo wordmark uses Norwester — a condensed geometric sans-serif by [Jamie Wilson](https://jamiewilson.github.io/norwester/). It looks great on the brand mark but is too restrictive for general UI use (uppercase-only, single weight, limited glyphs). Do NOT use Norwester for headings, labels, or any UI text outside the logo.

### Type Scale

Based on a 1.25 ratio (major third), anchored at 16px body.

| Token    | Size   | Font              | Weight  | Line Height | Usage                        |
| -------- | ------ | ----------------- | ------- | ----------- | ---------------------------- |
| `h1`     | 32px   | Plus Jakarta Sans | 700     | 1.2         | Page titles                  |
| `h2`     | 26px   | Plus Jakarta Sans | 700     | 1.25        | Section headers              |
| `h3`     | 20px   | Inter             | 700     | 1.3         | Card titles, subsections     |
| `h4`     | 16px   | Inter             | 600     | 1.4         | List group headers           |
| `body`   | 16px   | Inter             | 400     | 1.5         | Default body text            |
| `body-sm`| 14px   | Inter             | 400     | 1.5         | Secondary text, captions     |
| `caption`| 12px   | Inter             | 500     | 1.4         | Labels, timestamps, metadata |
| `overline`| 11px  | Plus Jakarta Sans | 600     | 1.6         | Category labels (uppercase)  |

### Logo Typography Rule

When displaying the brand name inline, follow the logo convention:
- **"BEE"** in `honey` (`#fdbc48`) — Norwester
- **"BUDDY"** in `forest` (`#3f4a30`) — Norwester
- Always uppercase (Norwester has no lowercase glyphs)

---

## 4. Shape Language — The Hexagon System

This is the defining visual characteristic of BeeBuddy. Hexagons replace rounded rectangles as the default interactive shape.

### Hexagon Construction

All hexagonal shapes use a **flat-top regular hexagon** (pointy sides, flat top/bottom). This matches natural honeycomb orientation and reads well as a button shape.

```
    ___________
   /           \
  /             \
 /               \
 \               /
  \             /
   \___________/
```

### CSS Hexagon (clip-path)

```css
/* Standard hexagon — use for buttons, avatars, badges */
.hex {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

/* Elongated hexagon — use for pills, tags, wider buttons */
.hex-wide {
  clip-path: polygon(8% 0%, 92% 0%, 100% 50%, 92% 100%, 8% 100%, 0% 50%);
}

/* Subtle hex — for cards and containers (barely angled corners) */
.hex-subtle {
  clip-path: polygon(3% 0%, 97% 0%, 100% 50%, 97% 100%, 3% 100%, 0% 50%);
}
```

### React Native Hexagon

Since `clip-path` isn't available in React Native, hexagonal shapes are built with SVG or rotated `View` overlays:

```tsx
// Hexagon component concept for React Native
import Svg, { Polygon } from 'react-native-svg';

function Hexagon({ size = 48, fill = '#fdbc48', children }) {
  const w = size;
  const h = size * 0.866; // height = width * sin(60)
  const points = `${w*0.25},0 ${w*0.75},0 ${w},${h/2} ${w*0.75},${h} ${w*0.25},${h} 0,${h/2}`;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Polygon points={points} fill={fill} />
    </Svg>
  );
}
```

### Where Hexagons Appear

| Element              | Shape                | Notes                                    |
| -------------------- | -------------------- | ---------------------------------------- |
| Primary buttons      | `hex-wide`           | Full hex silhouette, honey fill          |
| Icon buttons / FABs  | `hex`                | Square-proportioned hexagon              |
| Avatars              | `hex`                | User photos / hive thumbnails            |
| Status badges        | `hex` (small)        | Color-coded health indicators            |
| Cards                | `hex-subtle`         | Very slight hex corner cut               |
| Input fields         | Standard `rounded`   | Hexes on inputs hurt usability — skip    |
| Navigation tabs      | Standard `rounded`   | Hex tabs would feel forced               |
| Modals / sheets      | Standard `rounded`   | Keep standard for system-feel elements   |

**Rule of thumb:** Hex shapes for *things you tap* and *things that represent entities* (hives, inspections, users). Standard shapes for *containers* and *system UI*.

---

## 5. Spacing & Layout

### Base Unit

`4px` base. All spacing is a multiple of 4.

| Token   | Value | Usage                          |
| ------- | ----- | ------------------------------ |
| `xs`    | 4px   | Tight spacing within clusters  |
| `sm`    | 8px   | Icon-to-label, inline gaps     |
| `md`    | 16px  | Default padding, card internal |
| `lg`    | 24px  | Section separation             |
| `xl`    | 32px  | Major section breaks           |
| `2xl`   | 48px  | Page-level margins             |
| `3xl`   | 64px  | Hero sections, feature blocks  |

### Honeycomb Grid

For dashboard layouts and hive overview screens, use a **honeycomb grid** — offset hex tiles that tesselate:

```
  [ HEX ] [ HEX ] [ HEX ]
     [ HEX ] [ HEX ]
  [ HEX ] [ HEX ] [ HEX ]
```

Each tile is a hive, apiary, or data card. On mobile, this collapses to a standard vertical list. The honeycomb grid is a **progressive enhancement** for tablet/desktop widths (>768px).

### Standard Grid

For non-dashboard content (forms, settings, articles):
- **Mobile:** Single column, 16px horizontal padding
- **Tablet:** 2-column, 24px gutters
- **Desktop:** Max-width 1200px, 12-column grid, 24px gutters

---

## 6. Component Patterns

### Buttons

```
Primary:    hex-wide shape, honey fill, forest text, 600 weight
Secondary:  hex-wide shape, transparent fill, honey 2px border, honey text
Ghost:      no hex shape, forest text, hover underline
Danger:     hex-wide shape, danger fill, white text
Disabled:   hex-wide shape, forest-pale fill, forest-light text, 50% opacity
```

**Hover:** Honey buttons darken to `honey-dark`. Border shifts 2px outward (grows slightly).
**Press:** Scale down to 97%. Brief haptic on mobile.
**Focus:** 3px `honey` ring offset by 2px (a11y).

### Cards

- Background: `comb-cream` (light) / `bg-surface` (dark)
- Border: 1px `border` color
- Corner treatment: `hex-subtle` clip on feature cards, standard 12px radius on list items
- Shadow: `0 1px 3px rgba(63, 74, 48, 0.08)` — subtle, warm-tinted
- Hover (interactive cards): lift shadow to `0 4px 12px rgba(63, 74, 48, 0.12)`, translate Y -2px

### Hive Card (signature component)

The hive card is the most-used element in the app. It deserves its own spec:

```
+----hex-subtle-clip--------------------+
|  [HEX avatar]  Hive Name      [badge] |
|                Apiary Name             |
|  ----circuit-line-divider-----------   |
|  Last Inspected: Jan 15               |
|  Queen: Seen  |  Mood: Calm           |
|  Brood: Good  |  Stores: Medium       |
+----------------------------------------+
```

- Hex avatar shows hive photo or colored hex with hive number
- Badge is a small hex in semantic color (green=healthy, yellow=attention, red=critical)
- Circuit-line divider: a thin `forest-light` line with small dots at each end (mimicking the logo's circuit traces)

### Navigation

**Mobile (bottom tab bar):**
- 4-5 hex icon buttons in a row
- Active tab: `honey` fill hex with `forest` icon
- Inactive tab: transparent hex with `forest-light` icon
- Bar background: `forest-dark` or `comb-white` depending on mode

**Web (top navigation):**
- `forest` background bar
- Logo left, nav links center, user avatar (hex) right
- Active link: `honey` underline (3px, offset 4px below)
- Text: `comb-white`

### Inputs & Forms

Inputs stay rectangular (hexagonal inputs create usability problems with text alignment):
- Border: 1.5px `border` color, 8px radius
- Focus: border transitions to `honey`, subtle `honey-light` box-shadow
- Label: `caption` style, `forest-light` color, positioned above
- Error: border transitions to `danger`, error text in `danger` below

### Circuit-Trace Decorative Elements

Drawn from the logo's radiating circuit lines:

- **Dividers:** Instead of plain `<hr>`, a thin line with 3 small circles spaced along it
- **Progress indicators:** A line with a filled dot traveling along it (animated)
- **Connection lines:** On dashboard, thin lines connecting related hex tiles
- **Empty states:** A faded circuit-trace pattern as background illustration

```css
/* Circuit-line divider */
.circuit-divider {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent 0%,
    var(--forest-light) 10%,
    var(--forest-light) 90%,
    transparent 100%
  );
  position: relative;
}
.circuit-divider::before,
.circuit-divider::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--honey);
  top: -2.5px;
}
.circuit-divider::before { left: 10%; }
.circuit-divider::after { right: 10%; }
```

---

## 7. Iconography

### Style

- **Stroke-based**, 1.5px weight at 24px size
- Rounded caps and joins (friendly, organic feel)
- Use [Lucide](https://lucide.dev/) as the base icon set — it's open-source, consistent, and works in both React and React Native

### Custom Icons

These bee-specific icons should be created as custom SVGs to supplement Lucide:

| Icon           | Description                                      |
| -------------- | ------------------------------------------------ |
| `hive`         | Stacked boxes (Langstroth hive silhouette)       |
| `bee`          | Simplified bee (derived from logo silhouette)    |
| `queen`        | Bee with crown/dot marker                        |
| `frame`        | Single hive frame with comb pattern              |
| `honeycomb`    | 7-hex cluster (1 center + 6 surrounding)         |
| `smoker`       | Bee smoker tool silhouette                       |
| `hive-tool`    | Flat pry bar shape                               |
| `brood`        | Frame with dot pattern (larvae)                  |
| `swarm`        | Cluster of small dots in tree shape              |
| `varroa`       | Small mite icon (for pest tracking)              |

### Icon in Hexagon

For navigation and dashboard tiles, icons sit inside hex shapes:

```
   ___
  / * \    * = icon centered in hex
  \___/
```

The hex acts as the tap target (minimum 44x44px on mobile). The icon is sized to 60% of the hex width.

---

## 8. Motion & Animation

### Principles

- **Quick and purposeful.** Beekeepers use this tool in the field — animations should aid comprehension, never delay interaction.
- **Honey-like easing.** Use `cubic-bezier(0.4, 0, 0.2, 1)` — a slightly slow start with a smooth settle, like honey flowing.

### Timing

| Category    | Duration  | Usage                           |
| ----------- | --------- | ------------------------------- |
| Micro       | 100-150ms | Button press, toggle, checkbox  |
| Standard    | 200-300ms | Card expand, page transition    |
| Emphasis    | 400-500ms | Modal open, first-load reveal   |

### Signature Animations

- **Hex pulse:** When a hive status changes, its hex badge does a single scale pulse (1.0 -> 1.15 -> 1.0) in 300ms
- **Circuit trace:** Progress bars animate as a dot traveling along a line (like current through a circuit)
- **Honeycomb reveal:** Dashboard tiles stagger-fade-in along hex-grid diagonals on first load (50ms offset per tile)

### Reduced Motion

See [Section 9: Accessibility](#9-accessibility-wcag-21-aa-compliance) for full `prefers-reduced-motion` requirements.

---

## 9. Accessibility (WCAG 2.1 AA Compliance)

BeeBuddy targets **WCAG 2.1 Level AA** across all platforms. This is not optional.

### Verified Contrast Ratios

Every foreground/background pairing in the system has been tested. Only pairings
that meet the required ratio are permitted.

| Pairing                          | Ratio  | Level     | Usage                         |
| -------------------------------- | ------ | --------- | ----------------------------- |
| `forest` on `comb-white`        | 9.0:1  | AAA       | Body text on light bg         |
| `honey` on `forest-dark`        | 5.6:1  | AA        | Accent text on dark bg        |
| `forest` on `honey`             | 5.6:1  | AA        | Button text on honey fill     |
| `honey` on dark bg (#111b1d)    | 10.4:1 | AAA       | Accent text on dark mode bg   |
| `honey-dark` on `comb-white`    | 5.1:1  | AA        | Light-mode accent text        |
| `success` on `comb-white`       | 4.7:1  | AA        | Status text on light bg       |
| `warning` on `comb-white`       | 5.6:1  | AA        | Alert text on light bg        |
| `danger` on `comb-white`        | 5.2:1  | AA        | Error text on light bg        |
| `info` on `comb-white`          | 6.0:1  | AA        | Info text on light bg         |

**Minimum required ratios:**
- Normal text (< 18pt / < 14pt bold): **4.5:1**
- Large text (>= 18pt / >= 14pt bold): **3.0:1**
- UI components and graphical objects: **3.0:1**

### Forbidden Pairings

These combinations fail WCAG AA and must never be used for text:

| Pairing                          | Ratio | Problem                              |
| -------------------------------- | ----- | ------------------------------------ |
| `honey` (#fdbc48) on `comb-white`| 1.9:1 | Gold on white — invisible            |
| `honey-light` on `comb-white`   | 1.4:1 | Pale on pale — no contrast           |
| `forest-light` on `forest-dark` | 2.1:1 | Mid-green on dark-green — too close  |

### Touch Targets

- Minimum **44x44px** for all interactive hex elements (WCAG 2.5.5)
- Hex clip-paths must not shrink the visual tap area below this
- On mobile, prefer **48x48px** to match Material Design guidance

### Focus Indicators

- **3px solid `honey`** outline with **4px offset** on all focusable elements
- Never suppress `:focus-visible` — it is the primary keyboard navigation cue
- Focus ring must be visible on both light and dark backgrounds
- For hex-clipped elements, the outline sits outside the clip (use `outline-offset`)

### Color Independence

Color must never be the sole means of conveying information:

| Status     | Color       | Shape            | Icon           |
| ---------- | ----------- | ---------------- | -------------- |
| Healthy    | `success`   | Filled hex       | Checkmark      |
| Attention  | `warning`   | Half-filled hex  | Alert triangle |
| Critical   | `danger`    | Outline-only hex | X mark         |
| Info       | `info`      | Filled circle    | Info "i"       |

### Screen Readers & Semantic HTML

- Hex-shaped buttons use standard `<button>` or `<a>` elements with `aria-label`
- `clip-path` is purely visual — it does not affect the accessibility tree
- Decorative hex/circuit SVGs use `aria-hidden="true"` and `role="presentation"`
- Status badges include `aria-label` with the status text (not just color)
- Honeycomb grid uses `role="list"` / `role="listitem"` semantics

### Reduced Motion

Respect `prefers-reduced-motion: reduce`:
- All `transition` and `animation` durations become `0ms`
- Stagger reveals show all items simultaneously
- Pulse/trace animations replaced with static state indicators
- Parallax and auto-playing animations are fully disabled

---

## 10. Logo & Brand Assets

### Logo Anatomy

The BeeBuddy logo is a bee silhouette centered inside a rounded-square microchip, with circuit traces radiating outward to dot-terminated endpoints. The wordmark "BeeBuddy" sits to the right in a blocky geometric typeface — "Bee" in `honey`, "Buddy" in `forest-dark`.

### Logo Variants

Two color variants exist. **Both are approved** — use the correct one for the background context.

| Variant   | Chip bg     | Traces / text | Use on                        | File                           |
| --------- | ----------- | ------------- | ----------------------------- | ------------------------------ |
| **Dark**  | `#1a2628`   | `honey`       | Light backgrounds             | `BeeBuddy-full.svg`           |
| **Yellow**| `honey`     | `#1a2628`     | Dark backgrounds              | `BeeBuddy-Full-YellowVariant.svg` |

**Rule:** Always pick the variant that contrasts with the surface it sits on. The dark variant disappears on dark backgrounds; the yellow variant washes out on light backgrounds.

### Icon (no wordmark)

For app icons, favicons, and small-format uses, a standalone icon version (chip + bee, no text) is available:

| Asset               | Size      | Format | Source                          |
| -------------------- | --------- | ------ | ------------------------------- |
| `logo.svg`          | Vector    | SVG    | `apps/mobile/assets/logo.svg`  |
| `icon.png`          | 1024x1024 | PNG    | App store icon                  |
| `adaptive-icon.png` | 1024x1024 | PNG    | Android adaptive (30% padding)  |
| `splash-icon.png`   | 200x200   | PNG    | Expo splash screen              |
| `favicon.png`       | 48x48     | PNG    | Browser favicon (mobile app)    |
| `favicon.svg`       | Vector    | SVG    | Browser favicon (website)       |

All icon PNGs are generated from `logo.svg` with transparent backgrounds. Regenerate with:

```bash
npx sharp-cli -i logo.svg -o icon.png -- resize 1024 1024 --fit contain --background "transparent"
```

### Website Logo Configuration

The website (Starlight/Astro) swaps logo variants automatically by theme:

```js
// astro.config.mjs
logo: {
  alt: 'BeeBuddy',
  light: './src/assets/logo-light.png',   // dark variant
  dark: './src/assets/logo-dark.png',      // yellow variant
  replacesTitle: true,                     // wordmark is in the image
},
```

The hero image also uses light/dark variants via Starlight's frontmatter:

```yaml
hero:
  image:
    light: ../../assets/logo-light.png
    dark: ../../assets/logo-dark.png
```

### Logo Clear Space

Maintain a minimum clear space equal to the height of the chip (excluding circuit traces) on all sides. No other graphic elements, text, or edges should intrude into this zone.

### Logo Don'ts

- Do not place the dark variant on dark backgrounds (< 3:1 contrast)
- Do not recolor the logo — only the two approved variants exist
- Do not add drop shadows, outlines, or effects to the logo
- Do not stretch, skew, or rotate the logo
- Do not separate the chip icon from the wordmark in the full variant

---

## 11. Imagery & Illustration

### Photography

- Warm, natural tones — slight golden hour color grade
- Shallow depth of field on macro bee/flower shots
- Avoid sterile stock photography; favor authentic apiary settings

### Illustration Style

When illustrations are needed (onboarding, empty states, error pages):
- Line art in `forest` color, 2px stroke
- Selective `honey` fills on focal elements
- Circuit-trace decorative details woven into natural scenes (e.g., a flower with circuit-patterned petals)
- Flat, geometric style — no gradients or 3D effects

### Data Visualization

- Primary data color: `honey`
- Secondary data color: `forest`
- Chart gridlines: `forest-pale`
- Use hex-shaped data points instead of circles on scatter/line charts
- Bar charts can use hex-topped bars for brand flavor

---

## 12. Tailwind CSS Configuration (Web)

```js
// tailwind.config.js — BeeBuddy theme extension
module.exports = {
  theme: {
    extend: {
      colors: {
        honey: {
          DEFAULT: '#fdbc48',
          light: '#fee8b6',
          pale: '#fff7e5',
          dark: '#946000',
        },
        forest: {
          DEFAULT: '#3f4a30',
          light: '#5c6b47',
          pale: '#eef0eb',
          dark: '#2b331f',
        },
        comb: {
          white: '#fafaf7',
          cream: '#f5f2ea',
        },
        success: '#4a7c3f',
        warning: '#8b5a00',
        danger: '#c0392b',
        info: '#3b638a',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        logo: ['Norwester', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        hex: '0px', // hex shapes use clip-path, not border-radius
      },
      boxShadow: {
        card: '0 1px 3px rgba(63, 74, 48, 0.08)',
        'card-hover': '0 4px 12px rgba(63, 74, 48, 0.12)',
      },
      transitionTimingFunction: {
        honey: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
};
```

## 13. React Native Theme Constants (Mobile)

```ts
// theme/tokens.ts — BeeBuddy mobile theme
export const colors = {
  honey: {
    DEFAULT: '#fdbc48',
    light: '#fee8b6',
    pale: '#fff7e5',
    dark: '#946000',
  },
  forest: {
    DEFAULT: '#3f4a30',
    light: '#5c6b47',
    pale: '#eef0eb',
    dark: '#2b331f',
  },
  comb: {
    white: '#fafaf7',
    cream: '#f5f2ea',
  },
  semantic: {
    success: '#4a7c3f',
    warning: '#8b5a00',
    danger: '#c0392b',
    info: '#3b638a',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const typography = {
  display: 'PlusJakartaSans',
  body: 'Inter',
  mono: 'JetBrainsMono',
  logo: 'Norwester',  // Logo wordmark only — do NOT use for UI text
} as const;

export const shadows = {
  card: {
    shadowColor: '#3f4a30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHover: {
    shadowColor: '#3f4a30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;
```

---

## 14. Quick Reference — Do / Don't

| Do                                              | Don't                                          |
| ----------------------------------------------- | ----------------------------------------------- |
| Use hexagons for buttons and interactive tiles   | Put hexagons on every single element            |
| Keep `honey` for primary actions only           | Use honey as a background color for large areas |
| Use circuit-trace dividers sparingly             | Add circuit traces everywhere — it gets busy    |
| Let the forest/honey duo carry the brand        | Introduce additional brand colors               |
| Use warm whites and creams for backgrounds      | Use pure white (#fff) or cool grays             |
| Match the logo's blocky display font for headers | Use a thin or script font that clashes          |
| Show hive health with color + shape + icon      | Rely on color alone for status                  |
| Respect reduced motion preferences              | Force animations on all users                   |
