# Watch refinement — design

Date: 2026-10-15 · Status: approved in brainstorming (visual companion), pending written-spec review
Supersedes parts of: `2026-10-15-watch-faces-design.md` (the movement, the Full bleed and Classic faces, the desktop watch size)

## Intent

User feedback on the shipped watch faces:
- the watch is too big on the web; on the iPhone it looks good;
- the movement works but is not nice to look at, so remove it;
- the faces look like "a cheap toy watch"; they should look elegant;
- for legibility, the hands should reach their scales;
- offer a choice between analog and digital.

**Success:** the analog face reads as a fine dress watch (blued leaf hands, serif numerals, a railway
minute track) and is read at a glance. On desktop the watch is about 360 px, not half the screen. A
digital face is available in Settings. There is no movement, and the bundle is smaller than today.

**Decisions taken with the user (visual companion, 2026-10-15)**

| Question | Decision |
|---|---|
| Faces in Settings | **Analog** (default) and **Digital**; Full bleed and Classic are dropped |
| Analog dial | Mockup "A · Breguet" dial: twelve Arabic numerals in Cormorant Garamond, railway minute track |
| Analog hands | Mockup "C · Roman" leaf (feuille) hands in blued steel; no red anywhere (no "railway" red disc) |
| Seconds hand | Slightly thicker than the hairline of the mockup (~1.5×) |
| Digital font | **Bodoni Moda** |
| Desktop size | About **360 px** |
| Movement | Removed entirely |

The mockups are kept in `.superpowers/brainstorm/72683-1792073121/content/` (`dials.html`,
`analog-digital.html`). They are git-ignored and are reference material only.

## Experience

### Analog face (default)

SVG, viewBox `0 0 200 200`, centre (100, 100). Measurements are in viewBox units, as radii from
the centre.

- **Dial:** a disc of r 99 with a radial gradient (light `#fdfbf6 → #ece6da`, dark `#23272f → #0e1014`,
  centre at 50 % / 42 %).
- **Railway minute track:**
  - two rings, at r 96 and r 91.5, stroke 0.45;
  - 60 minute ticks between the rings, stroke 0.45;
  - five-minute ticks from r 90.5 to r 96, stroke 1.1.
- **Numerals:**
  - 1–12, at r 79, font size 13;
  - Cormorant Garamond 600 with lining figures (`font-feature-settings: 'lnum'`);
  - Latin digits in every language;
  - upright, not rotated.
- **Hands:** leaf (feuille) shapes in blued steel, filled with a horizontal three-stop gradient. All tips
  sit on their scales:
  - **Hour:** tip at r 68, just inside the numerals' inner edge (~r 72.5), with a short tail. Path
    `M100,32 C104.4,52 104.4,85 100,109 C95.6,85 95.6,52 100,32 Z`.
  - **Minute:** tip at r 94, inside the railway track. Path
    `M100,6 C103.2,36 103.2,80 100,111 C96.8,80 96.8,36 100,6 Z`.
  - **Seconds:**
    - a needle about 0.85 wide (from 0.56 in the mockup), tapering towards the tip;
    - tip at r 95, on the outer ring of the track; tail to r −22;
    - a slim lance counterweight `M100,108 L101.2,117 L100,125 L98.8,117 Z`;
    - blued, like the other hands.
  - **Centre cap:** blued, r 2.4.
- **Colours:**
  - **Light:**
    - numerals `#1d1f24`, track `#2a2c31`;
    - blued steel `#4a7fe0 → #244fae → #13306f`.
  - **Dark:**
    - numerals `#efe9dc`, track `#c9c3b6`;
    - a brighter, heat-blued `#9dbcff → #5f8ef0 → #3561c4`, so the hands stay readable on graphite.
  - Every colour is a CSS custom property (`--w-*`) set through classes. Gradient stops get their colour
    from classes, not `style` attributes, because the CSP is `style-src 'self'`.
- **Motion:**
  - the seconds hand ticks 8 times a second (125 ms steps, as now);
  - the hour and minute hands move continuously;
  - with reduced motion, the hands step once a second.

### Digital face

- 24-hour **HH:MM** in Bodoni Moda 400, with lining and tabular figures. Latin digits in every language.
- Seconds are shown smaller, beside the minutes and on the same baseline, in blued steel (`#2f5cc0`
  light, `#7aa2f7` dark).
- The colon is static (no blinking). Text colour is `#1d1f24` light and `#efe9dc` dark. There is no
  background panel; it sits on the page.
- It occupies the same box as the analog face, and its type is sized from the box width (container
  query units). The digits never wrap and never overflow the box at 320 px viewport width.
- It is updated once a second (the text is written only when it changes).
- **Font:** `@fontsource/bodoni-moda` (or its variable package), Latin subset, weight 400 only,
  self-hosted. The added woff2 must be ≤ 30 kB.

### Size and layout

- **Narrow (< 1024 px, including the iPhone):** unchanged from today.
- **Wide (≥ 1024 px):**
  - The watch box is `min(360px, …)`, keeping today's height-budget term so short screens still fit.
  - It is centred in the sticky left column, with the today lines below it.
  - The right column (converter and month views) is unchanged.
- The **"desktop: converter fully above the fold"** test must still pass.

### Settings

- The Watch group offers **Analog** · **Digital** (FA: **عقربه‌ای** · **دیجیتال**).
- Stored as `watch.face` in `settings.v1`, with values `analog` and `digital`.
- `fullbleed`, `classic`, a missing value or any unknown value all become `analog`.
- Changing the face swaps it immediately.

### Accessibility

- Both faces are `role="img"`, with the accessible name "Watch, 10:09" (FA: "ساعت، ۱۰:۰۹"), updated
  once a minute. The digital face's visible digits are `aria-hidden`.
- There is no toggle any more, so the movement toggle and its `aria-pressed` handling go.

## Removed

- **Watch modules:**
  - `src/watch/full-bleed.ts`
  - `src/watch/classic.ts`
  - `src/watch/movement-view.ts`
  - `src/watch/movement-parts.ts`
  - `src/watch/geometry.ts`, unless the new face reuses `polar` (then only `polar` stays)
- **Their tests**, plus the movement e2e tests.
- **Page parts:**
  - the `#movement-toggle` button and `#movement-mount`;
  - `#watch-digital`, the digits shown under the movement;
  - the movement strings (EN and FA).
- **Styles:**
  - the movement and Full bleed styles;
  - the `--w-plate*`, `--w-bridge*`, `--w-brass*`, `--w-steel*`, `--w-jewel` and `--w-spring` tokens;
  - the `.mv-*` and `.wf-*` rules;
  - the Classic `.wc-*` rules.
- **Model:** the train ratios, escapement, pallet and balance in `movement-model.ts`. The module keeps
  only what the faces need (hand angles, beat, `hhmm`) and is renamed `hands.ts`.
- **Docs:** the README sections on the movement, Full bleed and Classic.

## Architecture

```
src/watch/
  hands.ts           pure: (msOfDay, reduced) → { hour, minute, second, beat }; hhmm; BEAT_MS
  face.ts            FaceId = 'analog' | 'digital'; interface Face { root, render(state, date), destroy() }
  analog.ts          DOM: builds the analog SVG; renders the hands
  digital.ts         DOM: builds the digital face; writes HH:MM and seconds when they change
  watch-settings.ts  the Watch settings group (Analog · Digital)
  watch.ts           driver: face selection, rAF loop drawn per beat, reduced-motion interval,
                     pause when hidden, a11y label, onTick for main.ts
```

- **Driver:**
  - Draws only when the beat changes (≈ 8 fps) for both faces. The digital face writes text only when
    the second changes.
  - Reduced motion: a 1 s interval.
  - Hidden page: no drawing; on return it renders the current time immediately.
  - `Face.continuous` and the movement paths go.
- **`main.ts`:** wiring stays `createWatch(mount, { now, onTick, getFace, getLang })`. Any
  `setMovementOpen` / toggle wiring is removed.
- **Coverage:** 100 % stays the gate, and the existing exclusions are unchanged.

## Error handling

| Situation | Behaviour |
|---|---|
| `watch.face` missing, legacy (`fullbleed`, `classic`) or invalid | Analog |
| Bodoni Moda not yet loaded | The digital face renders in the fallback serif stack (`'Bodoni Moda', 'Cormorant Garamond', serif`); no layout jump beyond the font swap |
| Page hidden / clock offset change | As today: the loop stops; the next frame uses the new `now()` |

## Testing

- **Vitest (pure, 100 %):**
  - hand angles at known times;
  - 8 steps per second for the seconds hand, and 1 per second with reduced motion;
  - `hhmm`;
  - settings parsing, including the legacy values `fullbleed` and `classic` → `analog`.
- **Vitest + DOM:**
  - **Analog:**
    - builds 12 numerals, 60 ticks and 3 hands;
    - hand tip radii: hour 68, minute 94, seconds 95, read back from the path geometry;
    - rotations at a known time;
    - no `style` attributes.
  - **Digital:**
    - writes "10:09" and "36" at a known time;
    - writes only on change.
  - **Driver:**
    - draws per beat;
    - face swapping;
    - the label updates once a minute;
    - pause and resume.
- **Playwright:**
  - the face picker persists across reload;
  - the analog hands reach their scales, measured in the page via `getScreenCTM` tip positions;
  - the watch is ≤ 360 px wide at 1440 × 900 and 1280 × 800, and unchanged at 400 px;
  - light and dark via `emulateMedia`;
  - the FA page keeps Latin digits on both faces;
  - the midnight turnover still works;
  - the desktop above-the-fold test still passes;
  - a screenshot matrix (light/dark × 400/1440 × analog/digital) into `test-results/screens/`.
- **Claude:** drives the production Docker image in Chrome under the real CSP (both faces, both themes,
  phone and desktop widths) before calling it done.
- **User:** checks the result on the iPhone.

## Docs

- **README:** the watch section (faces, Settings), repo layout, test counts and bundle size.
- **`docs/SECURITY.md`:** test counts, if listed.

## Revision (2026-10-15, user feedback)

The user chose mockup A (Sinn-style) for a polished Analog face. These details supersede the Analog
dial, hand and Analog test details above; Digital, the driver, Settings and the layout are unchanged.

- **Numerals:** only 12, 3, 6 and 9, upright, at r 79, font size 19, in Inter (`--font-dial:
  'Inter Variable', system-ui, sans-serif`, not overridden on Persian pages), weight 600,
  `letter-spacing: -0.3px`, lining figures.
- **Batons:** a slim baton (`.wa-idx`, 2.4 × 19.5, r 71–90.5) at each of the other eight hours.
- **Rim:** a radial rim shade (`rim` gradient, transparent to `--wa-rim-a` black) over the dial disc.
  The railway track is unchanged.
- **Hand lengths:** hour r 70 (meets the batons), minute r 91 (meets the track's inner ring at
  r 91.5), seconds r 93.5 (inside the minute marks).
- **Hand finish:** the hour and minute leaf hands are faceted: a lit left half (`lit` gradient), a
  shaded right half (`shade` gradient) and a fine `.wa-edge` outline. The seconds needle and
  counterweight use the `sec` gradient; a domed cap (`cap` gradient, r 2.7) and a pin (`.wa-pin`,
  r 0.75) sit at the centre.
- **Shadow:** the three hands and the cap share one `feDropShadow` filter (`.wa-shadow`); the pin is
  drawn on top, outside it.
- **Colours:** new `--wa-lit-*`, `--wa-shade-*`, `--wa-sec-*`, `--wa-cap-*`, `--wa-pin`,
  `--wa-edge(-a)`, `--wa-shadow(-a)` and `--wa-rim-a` tokens for light and dark, applied through
  classes only (CSP `style-src 'self'`). The single `wa-blue-*` gradient and its tokens are removed.
- **Tests:** the DOM test expects numerals `12, 3, 6, 9`, 8 batons, tip radii 70 / 91 / 93.5, stop
  classes `wa-(dial|lit|shade|sec|cap|rim)-N`, unique gradient and filter ids per instance, and the
  hands inside one filtered group. The e2e reach test measures the outline (hour, minute) and the
  needle (seconds) on screen: hour 69–71.2, minute 90–91.7, seconds 92.5–95.
