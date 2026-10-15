# Watch faces — design

Date: 2026-10-15 · Status: approved in brainstorming (visual companion), pending written-spec review

## Intent

The analog clock at the top of the site is "minimal and alright … but a bit hard to read at a
glance, and a bit too minimal". Replace it with a mechanical-watch experience that is native to
a phone and a web page — not a picture of a wrist watch or a wall clock — following Raymond
Loewy's MAYA principle (*Most Advanced, Yet Acceptable*): instantly readable because it keeps
hands pointing at numbers, advanced in everything else.

**Success:** the time reads at a glance from arm's length on a phone; the default view is calm
(no gears); a "Show movement" control reveals a realistic, correctly geared movement running at
true speed; light and dark follow the system; the iPhone PWA left open for days does not burn
battery.

**Decisions taken with the user (visual companion, 2026-10-15)**

| Question | Decision |
|---|---|
| Direction | "Field" legibility (big 12/3/6/9, broad sword hands, red seconds), re-imagined screen-native: **Full bleed** — the screen is the dial, no case, bezel or strap |
| Movement visibility | Hidden by default; shown only via **Show movement**, as a realistic simulated gear train |
| Numerals | **Latin digits** on the watch always, including when the UI is in Persian |
| Theme | Follows the system light/dark setting; each mode designed, not inverted |
| Faces in Settings | **Full bleed** (default) + **Classic** (today's minimal clock) |
| Wide screens | **Sticky left half**: the watch large on the left, the rest scrolls on the right |

Out of scope: sound; device-motion parallax (iOS permission prompt); further complications
(moon phase etc.); the "Discs" and "Jump hour + retrograde" concepts explored in brainstorming.

## Experience

### Full bleed dial (default face)

- Edge to edge within its box: no case, bezel or lugs. Minute track with 60 marks (5-minute
  marks heavier, the 12/3/6/9 positions left to the numerals), numerals **12, 3, 6, 9** large
  and heavy (`--font-ui`, weight 800), Latin digits regardless of language.
- Hands: broad sword hour and minute hands; slim seconds hand in the accent red with a counter-
  weight; red centre cap.
- **Seconds tick 8 times a second** (4 Hz, 28 800 vph): the seconds hand advances in 125 ms
  steps; the hour and minute hands move continuously.
- Light mode: warm paper dial (`#fbf9f4 → #ebe6dc`), near-black numerals and hands
  (`#15181d` / `#1a1f26`), accent `#e0401f`. Dark mode: graphite (`#1d2128 → #0b0d10`), numerals
  `#f4f1e8`, lume-pale hands `#e9f5dd`, accent `#ff5a36`. Exact tokens live in `tokens.css`
  next to the existing palette; contrast ≥ 4.5:1 for numerals and ≥ 3:1 for hands and track
  against the dial in both modes.
- The today lines (Shamsi and Gregorian) remain the existing `#today` section under the watch.

### Show movement

- A quiet pill button under the dial: **Show movement** / **Show time** (EN), **نمایش موتور** /
  **نمایش ساعت** (FA). It is a toggle (`aria-pressed`).
- Pressing it lifts the dial away (opacity → 0, scale 1 → 1.08, ~0.9 s ease-out) while the
  movement settles in underneath (opacity → 1, scale 0.96 → 1). Reduced motion: an instant
  cross-fade.
- While the movement shows, the time is shown as large digits (`HH:MM`, Latin, 24-hour) under it.
- The state is session-only; the app always opens on the dial.

### The movement (realistic simulation)

A 4 Hz Swiss-lever caliber seen from the dial side with the dial removed, laid out with real
meshing distances (pitch radius = module × teeth / 2; meshing distance = sum of pitch radii):

| Part | Teeth | Driven by | Speed | Direction |
|---|---|---|---|---|
| Barrel (mainspring) | 96 | — | 1 turn / 8 h | counter-clockwise |
| Centre wheel / pinion | 80 / 12 | barrel | 1 turn / hour (= minute hand) | clockwise |
| Third wheel / pinion | 75 / 10 | centre wheel | 8 turns / hour | counter-clockwise |
| Fourth wheel / pinion | 80 / 10 | third wheel | 1 turn / minute (= seconds) | clockwise |
| Escape wheel / pinion | 15 (club teeth) / 5 | fourth wheel | 16 turns / minute, in 12° steps per beat | counter-clockwise |
| Pallet fork | 2 jewels | escape wheel | rocks once per beat | alternating |
| Balance + hairspring | — | pallet fork | 4 Hz, ±220°, through zero on every beat | oscillating |

- Every angle derives from the escapement's beat count: escape = beats × 12°, fourth =
  escape / 16, third = fourth / 7.5, centre = third / 8, barrel = centre / 8. Hence the centre
  wheel always matches the minute hand and the fourth wheel the seconds — by construction, and
  pinned by tests.
- The hairspring "breathes": its outer radius and phase follow the balance angle.
- Finishing: perlage (circular graining) on the main plate, Côtes-de-Genève stripes on the
  bridges, red jewels at every pivot, blued screws, a balance cock. Light and dark palettes.
- Part names: on touch devices, tapping a part shows its name and speed in a small caption; on
  wide screens labels sit alongside the movement. EN and FA strings.
- The movement SVG is built lazily on first open and removed when returning to the dial.

### Classic face

Today's minimal analog clock, unchanged in appearance, available as **Classic** in Settings.

### Layout

- **Phone / narrow (< 1024 px):** the watch fills the content width (max ~min(92vw, 62vh)),
  then the today lines, converter and month views scroll below as now.
- **Wide (≥ 1024 px):** a two-column grid. Left column: the watch, today lines and the movement
  toggle, `position: sticky; top: 0; height: 100vh`, vertically centred. Right column: converter
  and month views, scrolling. The existing test "desktop: converter incl. status row is fully
  above the fold" must still pass (the converter now sits at the top of the right column).
- RTL: the columns mirror (watch on the right in FA), as the rest of the page does; the watch
  itself is not mirrored.

### Settings

New group **Watch** in the Settings dialog: face = **Full bleed** (default) · **Classic**.
Stored as `watch.face` in `settings.v1`, validated per field like the other groups (unknown
value → `fullbleed`). Changing it swaps the face immediately.

### Accessibility

- The watch has `role="img"` and an accessible name with the current time ("10:38" /
  "۱۰:۳۸" in the FA label text — the *label* follows the UI language even though the dial
  digits are Latin), updated once a minute, not per frame.
- The movement toggle is a real `<button>` with `aria-pressed`; focus stays on it across the
  transition. Part captions are reachable by keyboard (focusable parts with `aria-label`) on
  wide screens.
- Reduced motion: hands step once a second, balance and pallet still, the escape train steps
  once a second, instant cross-fade.

## Architecture

```
src/watch/
  geometry.ts        pure: gear path (module, teeth), club-tooth escape wheel, spiral, mesh layout
  movement-model.ts  pure: (msOfDay, reduced) → angles for hands and every part (beats-based)
  palette.ts         pure: CSS custom-property names used by the faces (no colours in TS)
  face.ts            interface Face { mount(el), render(state), setMovement(open), destroy() }
  full-bleed.ts      DOM: builds the Full bleed dial SVG; renders hands from the model
  movement-view.ts   DOM: builds the movement SVG lazily; renders parts; part captions
  classic.ts         DOM: today's clock as a Face
  watch.ts           DOM: driver — face selection, rAF/interval loop, frame budget, pause on
                     hidden, reduced motion, movement toggle, a11y label, onTick for main.ts
```

- `clock.ts` and `clock-math.ts` are replaced by `src/watch/` (the Classic face keeps its look;
  `clock-math`'s logic moves into `movement-model.ts`). `main.ts` calls
  `createWatch(mount, { now: time.now, onTick, getFace, getLang })`.
- **Colours** are CSS custom properties (`--w-dial-0`, `--w-ink`, `--w-hand`, `--w-accent`,
  `--w-plate`, `--w-brass` …) defined for light and dark in `tokens.css`; SVG elements use
  classes, so a system theme change restyles live without re-rendering.
- **Frame budget:** with only the dial showing, the driver renders when the 125 ms beat changes
  (≈ 8 fps) — rAF is still used to stay in sync with paint, but frames inside a beat are
  skipped. With the movement showing, every rAF frame renders (balance needs 60 fps). Reduced
  motion: a 1 s interval, as today. Hidden page: everything stops (as today).
- **Coverage:** `src/watch/geometry.ts`, `movement-model.ts`, `palette.ts`, `face.ts` are
  covered at 100% like the rest of `src/`; the DOM modules are covered by DOM tests. The
  current exclusion of `src/clock/**` from coverage is removed with the folder; if the driver's
  rAF/paint specifics need an exclusion, it is limited to that one file and justified in
  `vite.config.ts`.

## Error handling

| Situation | Behaviour |
|---|---|
| `watch.face` missing / invalid in storage | Full bleed |
| Page hidden | Loop stops; resumes on visible, rendering the current time immediately |
| Clock offset changes (time sync) | Next frame uses the new `now()`; no animation catch-up |
| Movement open, then app hidden | Loop stops; on return the movement resumes at the current time |

## Testing

- **Vitest (pure, 100%):** gear path tooth count and radii; mesh distances equal the sum of
  pitch radii; the model's hand angles at known times; train consistency (centre wheel angle ≡
  minute hand mod 360, fourth ≡ seconds) across a day of sample times; escape steps exactly
  12° per beat; balance passes through 0 at every beat boundary; pallet alternates per beat;
  reduced-motion variants; settings parsing of `watch.face`.
- **Vitest + DOM:** driver renders ~8×/s with the dial and every frame with the movement
  (fake rAF/timers); pause on hidden and immediate render on visible; lazy movement build and
  removal; face switching via the store; a11y label updates once per minute; toggle
  `aria-pressed` and focus retention.
- **Playwright:** face picker persists across reload; Show movement / Show time; sticky left
  column at 1440 × 900 and stacked at 400 px; `emulateMedia({ colorScheme })` light and dark;
  FA page keeps Latin digits on the dial; the midnight turnover test still passes with the new
  face; the desktop above-the-fold test still passes; screenshot matrix light/dark × 400/1440 ×
  dial/movement written to `test-results/screens/`.
- **Claude:** drives the built app in Chrome (both faces, toggle, both themes, phone and desktop
  widths) before calling it done.
- **User:** looks at it on the iPhone (readability at arm's length, battery over a day).

## Docs

README: features (watch faces, movement, layout), Settings (Watch group), repo layout
(`src/watch/`), test counts, bundle size. `docs/SECURITY.md`: `settings.v1` also holds the
watch face (no personal data).
