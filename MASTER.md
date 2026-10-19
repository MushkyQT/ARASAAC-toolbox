# Atelier Pictos: design system

Single source of truth for the app's visual layer. Every colour, font, radius, shadow and duration
in `src/` comes from the tokens below (defined in `src/app/globals.css`, exposed to Tailwind via
`@theme`). The printed cards (category colours, card geometry, card fonts) are **not** part of
this system: they live in `src/lib/categories.ts` and `src/lib/cards/` and do not change.

## Theses (validated 2026-10-19)

**Visual.** A classroom display wall, light only: kraft-paper ground with a fine fibre grain,
every panel a warm-white sheet held up by tack, near-black ink and one fountain-pen ink blue for
actions and focus only, so the six category colours stay the only bright colour on screen;
Andika Bold for headings and keywords, because it was designed for children learning to read and
gives the interface the letterforms of their reading books without going cartoon, over Atkinson
Hyperlegible for running text; comfortable spacing on a 4px base (24px inside a sheet, 12px
between tiles); paper components with a 3px radius and contact shadows, word tiles tilted ±0.6°
as if put up by hand. Full redesign of the app layer; the six category colours and the card
format stay as they are.

**Interaction.** Quick and dry, 120 to 180ms on a single ease-out `cubic-bezier(0.2, 0, 0, 1)`:
a hovered word tile straightens and lifts 2px, new tiles land with a 180ms fade-and-settle
staggered 16ms (first 12 only), a picto swap crossfades in 120ms; no scroll effects, no bounce or
elastic, no infinite loops, nothing over 200ms on an action repeated word after word.

**Allowed patterns:** kraft paper ground with fibre grain; tack blobs on sheet corners; ±0.6°
tilt on word tiles (never on panels or inputs); contact shadows on sheets and tiles.

**Precision on the tilt.** A word tile in the board is a row that holds inputs (checkbox, label,
category). The tilt and the hover lift apply to the tile's **mini card** (the picto square with
the category border), which is the thing "put up by hand"; the row itself stays straight.

## Colour

Light only. No dark theme: the sheet preview must show print colours truthfully.

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `kraft` | `#C6A47C` | Page ground (with `--grain`) | ink on kraft 6.80:1 |
| `kraft-deep` | `#A9855B` | Kraft shade: tack shadow, decorative marks only | n/a (no text) |
| `sheet` | `#FFFDF8` | Every panel, dialog, tile, input | ink on sheet 15.61:1 |
| `paper` | `#FFFFFF` | The A4 pages and cards of the sheet preview only: print white, so colours read as printed | n/a |
| `ink` | `#1D2230` | Text, headings, strong borders | 15.61:1 on sheet |
| `ink-soft` | `#545A69` | Secondary text, hints | 6.79:1 on sheet, 5.60:1 on tack |
| `ink-blue` | `#2B44B0` | Primary action fill, focus ring, selected state, progress | 8.08:1 sheet on it |
| `ink-blue-press` | `#22378F` | Primary hover / active | 10.27:1 sheet on it |
| `ink-blue-wash` | `#E8EBF7` | Selected background (tabs, chosen picto) | ink-blue on it 6.91:1 |
| `tack` | `#ECE7DC` | Tack blobs, quiet fills (ghost hover, tab track) | ink on tack 12.87:1 |
| `rule` | `#E6DFD2` | Dividers inside a sheet (decorative) | n/a |
| `line` | `#877C6A` | Input and control boundaries | 4.03:1 on sheet, 3.33:1 on tack |
| `attention` | `#7A4A00` | "À vérifier" text, marker dot | 7.36:1 on sheet |
| `attention-wash` | `#F5ECD9` | "À vérifier" strip background | attention on it 6.37:1 |
| `danger` | `#A3231A` | Error text | 7.34:1 on sheet |
| `danger-wash` | `#F8E4E0` | Error strip background | danger on it 6.10:1 |

`attention` and `danger` are deliberately dark (ochre, brick) so they never read as the bright
adjective orange `#FF914D` or the person red `#FF3131`. Ink blue never fills a word tile or a
category chip. The category colours appear in the UI only as tile borders, category chips and
filter chips, exactly as on the cards.

## Type

Both faces are already in `public/fonts`, loaded with `next/font/local` (no third-party request).
Lexend is removed.

| Token | Value |
|---|---|
| `--font-display` | Andika (400, 700), fallback `"Atkinson Hyperlegible", Verdana, sans-serif` |
| `--font-sans` | Atkinson Hyperlegible (400, 700), fallback `Verdana, "Segoe UI", sans-serif` |

| Step | Size / line-height | Face | Use |
|---|---|---|---|
| title | 30px / 1.15 | display 700 | App name |
| section | 22px / 1.2 | display 700 | Sheet titles |
| keyword | 18px / 1.2, uppercase, +0.02em | display 700 | Word labels, picker heading |
| body | 16px / 1.55 | sans 400 | Text, inputs |
| small | 14px / 1.45 | sans 400/700 | Controls, notes |
| label | 12px / 1.3, uppercase, +0.06em | sans 700 | Field labels, counters |

Tabular figures (`tabular-nums`) on every counter (cards, pages, review position).

## Spacing

4px base, Tailwind's default scale (`1` = 4px). Sheet padding 24px (`p-6`; `p-4` under 640px).
Gap between tiles 12px (`gap-3`). Gap between sheets 32px (`gap-8`). Controls: 40px min height
(`h-10`), 8px horizontal gap between controls (`gap-2`).

## Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sheet` | 3px | Sheets, tiles, mini cards, dialog, thumbnails |
| `--radius-control` | 8px | Buttons, inputs, selects, chips |

No full-round pills.

## Shadows

| Token | Value | Use |
|---|---|---|
| `--shadow-sheet` | `0 1px 0 rgb(60 40 15 / .18), 0 6px 14px -8px rgb(60 40 15 / .45)` | Sheets, mini cards at rest |
| `--shadow-lift` | `0 2px 0 rgb(60 40 15 / .14), 0 12px 22px -10px rgb(60 40 15 / .5)` | Hovered mini card / thumbnail |
| `--shadow-focus` | `0 0 0 3px rgb(43 68 176 / .25)` | Focus ring on fields (with an `ink-blue` border) |
| `--shadow-dialog` | `0 2px 0 rgb(60 40 15 / .2), 0 24px 48px -16px rgb(60 40 15 / .55)` | Picto picker |

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | Everything |
| `--duration-swap` | 120ms | Picto crossfade, colour/background changes |
| `--duration-hover` | 160ms | Lift, straighten, button states |
| `--duration-enter` | 180ms | Tile arrival, dialog open |
| `--stagger` | 16ms | Tile arrival, first 12 tiles only |

Reduced motion: no tilt, no translate; arrival becomes a 180ms linear fade without stagger;
hover keeps only the shadow change.

Forbidden: scroll-linked effects, smooth-scroll animations, bounce/elastic, infinite loops other
than a real loading state, any animated `width`/`height`/`top`/`left`.

## Ground and tack

- `--grain`: an inline SVG `feTurbulence` tile (160px), fibres stretched horizontally, ink-brown
  at 22% alpha, laid over `kraft` on `body`.
- Tack: two 22×14px blobs in `tack`, rotated −8° and +6°, at the top corners of a **sheet**
  (`.sheet` utility). Not on dialogs, not on tiles.

## Components

- **Sheet** (`.sheet`): `sheet` bg, `radius-sheet`, `shadow-sheet`, 24px padding, tack blobs.
- **Primary button**: `ink-blue` fill, `sheet` text, 2px same-colour border, `radius-control`,
  14–16px bold. Hover/active `ink-blue-press`, active `translateY(1px)`, focus 3px `ink-blue` ring
  offset 3px, disabled `rule` fill + `ink-soft` text + not-allowed cursor.
- **Secondary button**: transparent, 2px `ink` border, `ink` text; hover `tack` fill.
- **Quiet button** (text link actions): `ink-soft` text, underline on hover.
- **Input / select / textarea**: `sheet` bg, 1px `line` border, `radius-control`; focus border
  `ink-blue` + 3px `ink-blue` ring at 25%.
- **Select chevron**: never the system arrow. The icon-set chevron (2px stroke) in `ink-soft`,
  16px, 12px from the right edge, vertically centred, with `pr-9` to clear it. On a coloured
  category chip it is drawn in the chip's `onColor`, 14px, 8px from the edge (`--chevron`,
  `--chevron-size`, `--chevron-inset`).
- **Checkbox / range**: `accent-color: ink-blue`.
- **Tabs**: `tack` track, selected tab `sheet` with `ink` text and contact shadow.
- **Category chip**: category colour fill, its `onColor` text, `radius-control`.
- **Filter chip**: 2px category-colour border, `sheet` fill; pressed: category fill.
- **Strips** (attention, error): wash background, 1px border in the strong colour at 30%, text
  in the strong colour.
- **Word tile**: straight `sheet` row with 1px `rule` border; mini card = 80px picto square,
  4px category border, `radius-sheet`, `shadow-sheet`, tilted `--tilt` (±0.6°, from the word id).
- **Step strip** (`.strip`, `Stepper`): a `sheet` strip without tack, sticky at the top edge.
  Step circles 28px (24px under 640px): done = `ink-blue` fill + check, current = `ink-blue`
  2px ring, upcoming = `line` ring; short titles and no status line under 640px.
- **Inline field** (`.inline-field`): text edited in place (card word, document title). Transparent,
  1px dashed `line` underline at rest (a line to fill in), `tack` wash on hover, full field focus.
  Its label is a sentence-case `ink-soft` hint under the field, never an uppercase label above it.
- **Word chip** (`.bank-chip`, "Autres mots du texte"): `sheet` fill, 1px `rule` border,
  `radius-control`, 15px bold label, a 32px thumbnail with a 2px category-colour border (a mini
  card in miniature), occurrence count `×3` in `ink-soft`, `+` icon turning `ink-blue` on hover.
- **Text view** (`.tv-*`): 70ch measure, 17px / 1.8. A keyword is underlined dotted `line` (proposed)
  or solid 3px in its category colour on an `ink-blue-wash` ground (on the board). Ignored text is
  `ink-soft` on a `tack` wash, struck through; a fully ignored paragraph is a dashed `line` block;
  three or more in a row fold into one block with "Afficher" and "Tout inclure".
- **Word peek** (`.tv-peek`, text view): the hovered (or keyboard-focused) keyword's mini card,
  64px, 3px category border, `shadow-lift`, the word's `--tilt`, 6px above the word (below it when
  the word touches the top of the screen), never catching the pointer. Opens after 250ms with a
  160ms fade and 4px settle, then follows the pointer from word to word with a 120ms glide and the
  picto crossfade; stays 120ms while crossing the gap between two words, closes with a 120ms fade,
  Escape closes it. A word with several possible pictograms (whatever its board state: no
  attention dot here, the dot stays the board's "unverified" mark) shows a second card fanned out
  behind (+5px, −4px, +4°), its border the category colour mixed 50% with `sheet`; it spreads out
  in 160ms as the peek opens and tucks back under a word with a single picto. Such a card grows a
  row of 5px dots under the picto (one per picture, at most 5 like the tile strip; `ink-blue` =
  the picture shown, the first is the card's own), anchored by its bottom so it grows upward. If the
  pointer stays 1s after the peek opens, the other pictures are shown once, 1.2s each with the
  120ms picto crossfade (border in that picto's category colour unless locked), then the peek
  returns to the card's picture and stops: one pass per hover, never a loop. Keyboard: ↑/↓ step
  through the pictures by hand, no auto pass. No browser `title`
  on keywords (it would double the peek); the hint is in `aria-description`. Touch: no peek.
  Reduced motion: fade only, no glide, no tilt (the back card keeps its offset, unrotated), no
  auto pass (↑/↓ still work).
- **Disclosure** (export panel): 1px `rule` box, `radius-control`; the summary line states the
  current values (« 8 cm · Open Sans · bordure 2 mm ») so nothing hides what will be printed.
- **Undo toast** (`Toast`): `ink` fill, `sheet` text, `shadow-dialog`, bottom centre, 10s, always
  with "Annuler" after a removal; preferred over a confirmation dialog.
- **Icons** (`icons.tsx`): drawn on a 20px grid, 2px stroke, round caps; no typed glyphs (×, ←, +).
- **Picto picker** (dialog): `sheet`, `radius-sheet`, `shadow-dialog`; backdrop `ink` at 45%,
  no blur.

## Dials (from the validated theses)

- `variance 4`: "paper components with a 3px radius… word tiles tilted ±0.6° as if put up by hand"
  (balanced, slight hand-made irregularity).
- `motion 3`: "quick and dry, 120 to 180ms… no scroll effects, no bounce".
- `density 5`: "comfortable spacing on a 4px base (24px inside a sheet, 12px between tiles)".
