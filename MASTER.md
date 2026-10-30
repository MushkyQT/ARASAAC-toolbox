# Atelier Pictos: design system

Single source of truth for the app's visual layer. Every colour, font, radius, shadow and duration
in `src/` comes from the tokens below (defined in `src/app/globals.css`, exposed to Tailwind via
`@theme`). The printed cards (category colours, card geometry, card fonts) are **not** part of
this system: they live in `src/lib/categories.ts` and `src/lib/cards/` and do not change.

## Theses (validated 2026-10-30)

**Visual.** A light, warm workbench: the page is the existing kraft brown (`#C6A47C`, kept for its
warmth) printed as a cutting mat with a real centimetre grid and a ruler edge (the cards are
8 × 8 cm, and the grid measures them); every panel is white paper sealed in a laminate pouch with a
clear rim, corner-punched rounds and one static sheen; graphite ink is the only action colour, so
the six category colours stay the only bright colour on screen; Atkinson Hyperlegible Next for
everything (ExtraBold for headings and keywords, Regular for text), because it was drawn for
low-vision readers and these users make materials for people who struggle to read, with its Mono
sibling for measurements and counts; generous spacing on a 4px base (28px inside a sheet, 16px
between tiles); laminated components with a 14px rim radius, crisp contact shadows, no tilt. Full
redesign of the app layer: the six category colours and the printed card format stay as they are.

**Interaction.** Quick and dry on everything repeated (120 to 160ms, ease-out
`cubic-bezier(0.2, 0, 0, 1)`), with one generous moment: when the analysis finishes, the word
tiles land on the board family by family (280ms settle on `cubic-bezier(0.16, 1, 0.3, 1)`, 90ms
between colour families, 22ms between tiles, first 18 only), and each mini card catches one sheen
glint as it seals (520ms, once); a hovered mini card lifts 2px while its sheen slides; picto swaps
crossfade in 120ms; no scroll effects, no bounce or overshoot, no loops, no confetti or mascots,
nothing over 160ms on an action repeated word after word.

**Allowed patterns:** centimetre cutting-mat grid with a ruler edge on the page ground; laminate
rim on sheets and mini cards; one static diagonal sheen on laminated surfaces; one-shot sheen glint
on arrival only; contact shadows; mono figures for measurements and counts.

Users: special-ed teachers and speech therapists (orthophonistes, AESH) preparing material at a
desk. The fun is for the adult (craft, satisfying moments), never childish: nothing toy-like,
clinical or generic SaaS.

## Colour

Light only. No dark theme: the sheet preview must show print colours truthfully.

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `kraft` | `#C6A47C` | Page ground (the cutting mat) | ink on kraft 6.88:1 |
| `kraft-grid` | `#B8956B` | 1 cm lines on the mat (decorative) | n/a |
| `kraft-deep` | `#A9855B` | 5 cm lines, ruler ticks (decorative) | n/a |
| `kraft-ink` | `#4A3A26` | The only text allowed directly on kraft: ruler figures, footer credit | 4.68:1 on kraft |
| `sheet` | `#FFFEFB` | Paper inside the laminate: every panel, dialog, tile, input | ink on sheet 15.90:1 |
| `paper` | `#FFFFFF` | The A4 pages and cards of the sheet preview, mini card faces: print white | n/a |
| `ink` | `#24211C` | Graphite: text, headings, primary action fill, focus ring, selected outline | 15.90:1 on sheet |
| `ink-press` | `#3A352D` | Primary hover / active | sheet on it 12.06:1 |
| `ink-soft` | `#5E574C` | Secondary text, hints, counts | 7.07:1 on sheet, 5.90:1 on wash |
| `wash` | `#EFE9DD` | Quiet fills: ghost hover, tab track, selected background | ink on wash 13.27:1 |
| `rule` | `#E8E1D4` | Dividers and tile borders inside a sheet (decorative) | n/a |
| `line` | `#8A7F6D` | Input and control boundaries (always on sheet) | 3.90:1 on sheet |
| `attention` | `#7A4A00` | "Image à vérifier" text, marker dot | 7.42:1 on sheet |
| `attention-wash` | `#F6ECD6` | "À vérifier" strip background | attention on it 6.37:1 |
| `danger` | `#A3231A` | Error text | 7.40:1 on sheet |
| `danger-wash` | `#F9E4DF` | Error strip background | danger on it 6.11:1 |

Rules:
- `ink-soft` is **never** set directly on kraft (3.06:1). On kraft, text is `ink` or `kraft-ink`.
- `line` is never set directly on kraft (2.84:1): controls always sit on a sheet.
- Graphite never fills a word tile or a category chip. The category colours appear in the UI only
  as mini card borders, category chips and filter chips, exactly as on the cards.

## Type

Vendored woff2 (Latin subset) in `public/fonts/`, loaded with `next/font/local`: no third-party
request. The card fonts (Open Sans, Andika, Atkinson Hyperlegible) stay in `public/fonts/` for the
exports.

| Token | Value |
|---|---|
| `--font-sans` | Atkinson Hyperlegible Next (400, 700, 800), fallback `Verdana, "Segoe UI", sans-serif` |
| `--font-display` | same family as `--font-sans`, used at 800 |
| `--font-mono` | Atkinson Hyperlegible Mono (500, 600), fallback `ui-monospace, Menlo, monospace` |

| Step | Size / line-height | Face | Use |
|---|---|---|---|
| title | 34px / 1.08, −0.01em | display 800 | App name |
| section | 22px / 1.2 | display 700 | Sheet titles |
| keyword | 18px / 1.2, uppercase, +0.02em | display 800 | Word labels, picker heading |
| body | 16px / 1.55 | sans 400 | Text, inputs |
| small | 14px / 1.45 | sans 400/700 | Controls, notes |
| label | 12px / 1.3, uppercase, +0.06em | sans 700 | Field labels |
| measure | 13px / 1.3, tabular | mono 600 | Counts, sizes, page numbers, review position, ruler |

The `.measure` class sets this step. Mono stops at measurements and counts (`19 cartes`, `8 cm`, `4 pages A4`, `3 / 10`). Labels,
navigation and captions stay in the sans.

## Spacing

4px base, Tailwind's default scale (`1` = 4px). Sheet padding 28px (`p-7`; `p-5` under 640px).
Gap between tiles 16px (`gap-4`). Gap between sheets 40px (`gap-10`): the laminate rim needs air.
Controls: 42px min height, 8px gap between controls (`gap-2`).

## Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sheet` | 14px | Laminated sheets, dialog (the rim adds 6px outside) |
| `--radius-card` | 10px | Mini cards, word tiles, thumbnails, chips with a picto |
| `--radius-control` | 10px | Buttons, inputs, selects, chips |

Corner-punched rounds everywhere; no full-round pills, no square corners on laminated things.

## Laminate and shadows

| Token | Value | Use |
|---|---|---|
| `--laminate` | `rgb(255 255 255 / 0.55)` | The clear rim of the pouch |
| `--laminate-edge` | `rgb(36 33 28 / 0.12)` | The cut edge of the pouch |
| `--shadow-sheet` | rim 6px + edge 1px + `0 16px 26px -16px rgb(60 45 20 / .5)` | Sheets |
| `--shadow-card` | rim 3px + edge 1px + `0 6px 10px -6px rgb(60 45 20 / .45)` | Mini cards at rest |
| `--shadow-lift` | rim 3px + edge 1px + `0 12px 18px -8px rgb(60 45 20 / .5)` | Hovered mini card / thumbnail |
| `--shadow-dialog` | rim 6px + edge 1px + `0 28px 56px -18px rgb(40 30 15 / .6)` | Picto picker |
| `--shadow-focus` | `0 0 0 3px rgb(36 33 28 / .22)` | Focus ring on fields (with an `ink` border) |
| `--shadow-contact` | `0 1px 0 rgb(60 45 20 / .12), 0 2px 4px -1px rgb(60 45 20 / .25)` | Selected tab (no laminate) |
| `--shadow-page` | `0 1px 0 rgb(60 45 20 / .18), 0 12px 22px -12px rgb(60 45 20 / .55)` | A4 pages of the sheet preview (`.print-page`) |
| `--sheen` | `linear-gradient(115deg, transparent 28%, rgb(255 255 255 / .38) 40%, transparent 52%)` | Static sheen, `soft-light` blend |

The rim is drawn with `box-shadow` spread, so it never changes layout. The sheen sits in a
pseudo-element with `pointer-events: none`.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | Everything repeated |
| `--ease-land` | `cubic-bezier(0.16, 1, 0.3, 1)` | The landing only (no overshoot) |
| `--duration-swap` | 120ms | Picto crossfade, colour/background changes, press |
| `--duration-hover` | 160ms | Lift, sheen slide, button states, dialog open |
| `--duration-land` | 280ms | Tile landing: `translateY(-10px) scale(1.03)` → rest |
| `--duration-glint` | 520ms | Sheen glint, once per tile, 200ms after it lands |
| `--family-gap` | 90ms | Delay between colour families in the landing |
| `--stagger` | 22ms | Delay between tiles of a family, first 18 tiles only |

The landing plays when a new analysis fills the board (a new text, "Mettre à jour les mots"),
never when a single word is added or the page reloads from storage with the same words. It is
played by script (`landOnBoard` in `WordBoard.tsx`, Web Animations API, reading the duration
tokens above) so that a list remounted by a filter or a view switch never replays it. A tile that
simply appears (a word added by hand, a remount) fades in over `duration-swap` (`.tile-added`).

Reduced motion: no lift, no translate, no glint; the landing becomes a 160ms linear fade without
stagger; hover keeps only the shadow change.

Forbidden: scroll-linked effects, smooth-scroll animations, bounce/overshoot/elastic, infinite
loops other than a real loading state, confetti, mascots, any animated `width`/`height`/`top`/`left`.

## Ground

- `body`: `kraft`, with two grids drawn by `linear-gradient`: 1px `kraft-grid` lines every `1cm`,
  1px `kraft-deep` lines every `5cm`. No grain, no texture image.
- **Ruler** (`.ruler`): a strip along the top of the page, millimetre ticks in `kraft-deep`,
  centimetre ticks and figures in `kraft-ink`, mono 10px. Decorative, `aria-hidden`.

## Components

- **Sheet** (`.sheet`): `sheet` bg, `radius-sheet`, `shadow-sheet` (laminate rim), static sheen.
- **Primary button**: `ink` fill, `sheet` text, 2px same-colour border, `radius-control`, a 1px
  inner top highlight (`inset 0 1px 0 rgb(255 255 255 / .18)`), 15px bold. Hover `ink-press`,
  active `translateY(1px)`, focus 3px `ink` ring offset 3px, disabled `wash` fill + `ink-soft`
  text + not-allowed cursor.
- **Secondary button**: transparent, 2px `ink` border, `ink` text; hover `wash` fill.
- **Quiet button** (text actions): `ink-soft` text, underline on hover, `ink` on hover.
- **Input / select / textarea**: `sheet` bg, 1px `line` border, `radius-control`; focus border
  `ink` + `shadow-focus`.
- **Select chevron**: never the system arrow. The icon-set chevron (2px stroke) in `ink-soft`,
  16px, 12px from the right edge, with `pr-9`. On a category chip it is drawn in the chip's
  `onColor`, 14px, 8px from the edge (`--chevron`, `--chevron-size`, `--chevron-inset`).
- **Checkbox / range**: `accent-color: ink`.
- **Tabs**: `wash` track, selected tab `sheet` with `ink` text and contact shadow.
- **Category chip**: category colour fill, its `onColor` text, `radius-control`.
- **Filter chip**: 2px category-colour border, `sheet` fill; pressed: category fill.
- **Strips** (attention, error): wash background, 1px border in the strong colour at 30%, text in
  the strong colour.
- **Word tile**: straight `sheet` row, 1px `rule` border, `radius-card`; **mini card** = 80px
  `paper` square, 4px category border, `radius-card`, `shadow-card` (3px laminate rim), static
  sheen in `::before`, glint in `::after` (only during the landing). No tilt.
- **Chosen picto** (alternatives strip, picker grid): 2px `ink` outline offset 2px on `wash`.
- **Inline field** (`.inline-field`): text edited in place (card word, document title).
  Transparent, 1px dashed `line` underline at rest, `wash` on hover, full field focus. Its label
  is a sentence-case `ink-soft` hint under the field.
- **Word chip** (`.bank-chip`, "Autres mots du texte"): `sheet` fill, 1px `rule` border,
  `radius-control`, 15px bold label, a 32px thumbnail with a 2px category border and a 2px
  laminate rim, occurrence count `×3` in mono `ink-soft`, `+` icon turning `ink` on hover.
- **Text view** (`.tv-*`): 70ch measure, 17px / 1.8. A keyword is underlined dotted `line`
  (proposed) or solid 3px in its category colour on a `wash` ground (on the board). Ignored text is
  `ink-soft` on a `wash` ground, struck through; a fully ignored paragraph is a dashed `line`
  block; three or more in a row fold into one block with "Afficher" and "Tout inclure".
- **Word peek** (`.tv-peek`): the hovered keyword's mini card, 64px, 3px category border,
  `shadow-lift` with its laminate rim, 6px above the word. Behaviour unchanged from the previous
  system (250ms open delay, 160ms fade and 4px settle, 120ms glide and crossfade, one auto pass of
  the other pictures, never a loop), except: no tilt, and the fanned back card is offset
  (+5px, −4px) without rotation.
- **Disclosure** (export panel): 1px `rule` box, `radius-control`; the summary line states the
  current values in mono (`8 cm · Open Sans · bordure 2 mm`).
- **Sheet preview** (A4 pages): `paper` pages with the print shadow, no laminate (paper is not
  laminated until printed).
- **Undo toast**: a laminated slip: `sheet`, `radius-card`, `shadow-lift`, 14px `ink` text, top
  centre, drops in 8px. "Annuler" is a quiet `ink` bold action (`wash` on hover).
- **Icons** (`icons.tsx`): 20px grid, 2px stroke, round caps; no typed glyphs.
- **Picto picker** (dialog): `sheet`, `radius-sheet`, `shadow-dialog`; backdrop `ink` at 45%, no
  blur. Opens in 160ms (fade + 6px rise).

## Dials (from the validated theses)

- `variance 4`: "laminated components with a 14px rim radius, crisp contact shadows, no tilt"
  (balanced, one strong material idea).
- `motion 4`: "quick and dry on everything repeated … with one generous moment".
- `density 3`: "generous spacing on a 4px base (28px inside a sheet, 16px between tiles)".
