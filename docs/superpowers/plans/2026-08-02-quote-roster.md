# 366-Thinker Quote Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-author Stoic quote pool with 366 distinct global thinkers — one primary-source-verified quote each, strictly secular, bilingual (en/fa), with the citation shown in both languages.

**Architecture:** Roster-first pipeline with staged artifacts under `docs/quotes-work/` (curation → research → adversarial verification → Farsi translation), a deterministic assembly script that emits the shipped `Site/public/quotes.json` plus a repo-only `docs/quotes-audit.json`, and a small code change (`source_fa` field end-to-end). Research/verification stages run as batched parallel subagents; every stage has a machine validation gate before the next stage starts.

**Tech Stack:** Node ≥22 (`.mjs` scripts, no deps), Vitest, Playwright, subagent batches with WebSearch/WebFetch.

## Global Constraints

- Exactly 366 entries, `d` = 1…366 each exactly once, 366 unique `author_en`.
- One quote per thinker. English text ≤200 characters.
- **Strictly secular content**: no scripture, no devotional/doctrinal material; the filter is on the quote's content, not the author's faith. Mystic poets only via humanist verses.
- **Primary source required**: every quote traceable to a citable work (book/letter/essay/lecture/speech, with section where the work has one), checked against the actual text or a scholarly/Wikiquote-*sourced* record. Untraceable → replaced, regardless of fame. Ancients via doxography cite the transmitting work (e.g. Diogenes Laertius, *Lives* VI).
- Farsi: natural literary Farsi; Persian digits (۰–۹) inside `source_fa`; established Persian name forms (ارسطو، کانت، …).
- Intermediate artifacts live in `docs/quotes-work/` and are committed (audit trail).
- All existing tests stay green after the final task; earlier tasks must not touch `Site/`.
- Commit after each task.
- Spec: `docs/superpowers/specs/2026-08-02-mobile-pwa-and-quotes-design.md` (Section 2).

## Artifact contracts

```
docs/quotes-work/roster.json      [{ slug, name_en, name_fa, era, tradition, field, reserve }]
docs/quotes-work/batch-NN.json    [{ slug, en, source, evidence_url, evidence_note }]      NN = 01…13
docs/quotes-work/verify-NN.json   [{ slug, verdict: "pass"|"fail", reason }]
docs/quotes-work/fa-NN.json       [{ slug, fa, author_fa, source_fa }]
docs/quotes-audit.json            [{ d, slug, author_en, source, evidence_url, evidence_note }]
Site/public/quotes.json           [{ d, en, fa, author_en, author_fa, source, source_fa }]
```

`tradition` ∈ `antiquity-west | persian-islamic | east-south-asia | medieval-renaissance | enlightenment-19c | modern`.

---

### Task 1: Roster — 366 thinkers + 40 reserves

**Files:**
- Create: `docs/quotes-work/roster.json`
- Create: `Site/scripts/validate-roster.mjs`

**Interfaces:**
- Produces: `roster.json` per the artifact contract; slugs are kebab-case (`hannah-arendt`) and are the join key for every later stage.

- [ ] **Step 1: Write the validation script first** — `Site/scripts/validate-roster.mjs`:

```js
import { readFileSync } from 'node:fs';

const TRADITIONS = { 'antiquity-west': 55, 'persian-islamic': 55, 'east-south-asia': 50,
  'medieval-renaissance': 35, 'enlightenment-19c': 75, 'modern': 96 };
const roster = JSON.parse(readFileSync('docs/quotes-work/roster.json', 'utf8'));
const errors = [];
const primaries = roster.filter((t) => !t.reserve);
if (primaries.length !== 366) errors.push(`primaries: ${primaries.length} ≠ 366`);
if (roster.length - primaries.length !== 40) errors.push(`reserves: ${roster.length - primaries.length} ≠ 40`);
const slugs = new Set(roster.map((t) => t.slug));
if (slugs.size !== roster.length) errors.push('duplicate slugs');
const names = new Set(roster.map((t) => t.name_en.toLowerCase()));
if (names.size !== roster.length) errors.push('duplicate names');
for (const t of roster) {
  for (const f of ['slug', 'name_en', 'name_fa', 'era', 'tradition', 'field'])
    if (!t[f] || typeof t[f] !== 'string') errors.push(`${t.slug ?? '?'}: missing ${f}`);
  if (typeof t.reserve !== 'boolean') errors.push(`${t.slug}: reserve not boolean`);
  if (!(t.tradition in TRADITIONS)) errors.push(`${t.slug}: unknown tradition ${t.tradition}`);
}
for (const [tr, quota] of Object.entries(TRADITIONS)) {
  const n = primaries.filter((t) => t.tradition === tr).length;
  if (n !== quota) errors.push(`${tr}: ${n} ≠ quota ${quota}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`roster ok: 366 primaries + 40 reserves, quotas met`);
```

Run: `node Site/scripts/validate-roster.mjs` → expect FAIL (no roster.json yet).

- [ ] **Step 2: Curate the roster via 6 parallel subagents** (one per tradition, quota + ~7 reserves each). Each curator prompt must include: the JSON contract above; its tradition's quota; selection criterion "wisdom density, not fame — include the under-quoted"; deliberate inclusion of women thinkers; candidates must plausibly have *citable written/transmitted works* (rules out purely legendary figures); no heads of living religions or figures whose only notable output is devotional. Merge outputs, resolve duplicates across traditions (a thinker belongs to exactly one), fill shortfalls.

- [ ] **Step 3: Validate + human skim**

Run: `node Site/scripts/validate-roster.mjs`
Expected: `roster ok`. Then print the 406 names grouped by tradition for Ali to skim (the roster is the highest-leverage review point in this plan).

- [ ] **Step 4: Commit**

```bash
git add docs/quotes-work/roster.json Site/scripts/validate-roster.mjs
git commit -m "feat(quotes): curated roster — 366 thinkers + 40 reserves across six traditions"
```

---

### Task 2: Quote research, 13 batches

**Files:**
- Create: `docs/quotes-work/batch-01.json` … `batch-13.json` (12×28 + 1×30 = 366)
- Create: `Site/scripts/validate-batches.mjs`

**Interfaces:**
- Consumes: `roster.json` slugs (primaries only, ordered by slug, sliced into batches).
- Produces: one researched entry per primary slug, per the `batch-NN.json` contract.

- [ ] **Step 1: Write the validation script** — `Site/scripts/validate-batches.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs';

const roster = JSON.parse(readFileSync('docs/quotes-work/roster.json', 'utf8'));
const primarySlugs = new Set(roster.filter((t) => !t.reserve).map((t) => t.slug));
const rosterSlugs = new Set(roster.map((t) => t.slug));
const files = readdirSync('docs/quotes-work').filter((f) => /^batch-\d\d\.json$/.test(f)).sort();
const errors = [];
const seen = new Set();
let total = 0;
for (const f of files) {
  for (const q of JSON.parse(readFileSync(`docs/quotes-work/${f}`, 'utf8'))) {
    total += 1;
    if (!rosterSlugs.has(q.slug)) errors.push(`${f}: ${q.slug} not in roster`);
    if (seen.has(q.slug)) errors.push(`${f}: duplicate ${q.slug}`);
    seen.add(q.slug);
    if (!q.en?.trim()) errors.push(`${q.slug}: empty en`);
    if ((q.en ?? '').length > 200) errors.push(`${q.slug}: en ${q.en.length} chars > 200`);
    if (!q.source?.trim()) errors.push(`${q.slug}: empty source`);
    if (!/^https?:\/\//.test(q.evidence_url ?? '')) errors.push(`${q.slug}: evidence_url not a URL`);
  }
}
if (total !== 366) errors.push(`total ${total} ≠ 366`);
// Replacements from the reserve list are allowed; unreplaced primaries are not.
const missing = [...primarySlugs].filter((s) => !seen.has(s));
if (missing.length && total === 366)
  console.log(`note: ${missing.length} primaries replaced by reserves: ${missing.join(', ')}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`batches ok: ${total} quotes across ${files.length} files`);
```

- [ ] **Step 2: Research each batch via parallel subagents.** Each researcher gets ~28 roster entries and must return the `batch-NN.json` contract. Prompt requirements (verbatim into each prompt):
  - One quote per thinker; the *wisest, most distilled* line, not the most famous.
  - ≤200 characters English; a published English translation for non-English authors (name the translator/edition in `evidence_note` when known).
  - Strictly secular content (rule as in Global Constraints).
  - `source` = the citable work + section (e.g. `Meditations X.6`, `Letter to Menoeceus`, `Nicomachean Ethics II.1`, `Diogenes Laertius, Lives VI`).
  - `evidence_url` = URL where the sourced attribution can be checked (Wikiquote **sourced** section, Perseus, Project Gutenberg text, publisher/scholarly page). Wikiquote "Attributed"/"Disputed" sections are NOT acceptable evidence.
  - If no verifiable quote exists for a thinker, return that slug with `"en": ""` and explain in `evidence_note` — do NOT invent or settle for apocrypha. (Replacement happens in Task 3.)
  - Web access: use WebSearch/WebFetch; do not rely on memory alone for the evidence URL.

- [ ] **Step 3: Handle research failures.** For every slug returned empty, pick a reserve from the same tradition, dispatch a follow-up researcher, and update the batch file. Repeat until `validate-batches.mjs` passes.

Run: `node Site/scripts/validate-batches.mjs`
Expected: `batches ok: 366 quotes`.

- [ ] **Step 4: Commit**

```bash
git add docs/quotes-work/batch-*.json Site/scripts/validate-batches.mjs
git commit -m "feat(quotes): researched 366 sourced quotes in 13 batches"
```

---

### Task 3: Adversarial verification

**Files:**
- Create: `docs/quotes-work/verify-01.json` … `verify-13.json`

**Interfaces:**
- Consumes: `batch-NN.json`.
- Produces: pass/fail verdict per slug; failed slugs are replaced in the batch files (contract unchanged).

- [ ] **Step 1: Dispatch one independent verifier subagent per batch** (fresh context, does NOT see the researcher's reasoning). Verifier prompt (verbatim requirements):
  - For each entry, attempt to REFUTE it on four axes: (a) quote not actually traceable to the cited work; (b) known misattribution/apocrypha (check Quote Investigator, Wikiquote talk/misattributed sections); (c) religious/devotional content; (d) meaning-distorting paraphrase of the original.
  - Open the `evidence_url` (WebFetch) and confirm it actually supports the attribution — a dead or irrelevant link is a FAIL.
  - Default to `fail` when uncertain. Output `verify-NN.json` per the contract, `reason` mandatory for fails.

- [ ] **Step 2: Replacement loop.** For each `fail`: replace the quote (same thinker, different verified quote) or the thinker (reserve from the same tradition), re-research, re-verify with a fresh verifier. Iterate until every verdict in every `verify-NN.json` is `pass` and `validate-batches.mjs` still passes.

- [ ] **Step 3: Spot-check.** Manually open the `evidence_url` of 10 randomly sampled entries (`node -e` with a fixed seed, or pick d ∈ {13, 42, …}) and confirm the chain: quote → source → evidence. Report the sample in the commit message.

- [ ] **Step 4: Commit**

```bash
git add docs/quotes-work/batch-*.json docs/quotes-work/verify-*.json
git commit -m "feat(quotes): adversarial verification pass — all 366 quotes confirmed"
```

---

### Task 4: Farsi translation

**Files:**
- Create: `docs/quotes-work/fa-01.json` … `fa-13.json`
- Create: `Site/scripts/validate-fa.mjs`

**Interfaces:**
- Consumes: verified `batch-NN.json` + roster `name_fa`.
- Produces: `fa-NN.json` per contract; join key `slug`.

- [ ] **Step 1: Write the validation script** — `Site/scripts/validate-fa.mjs`:

```js
import { readFileSync, readdirSync } from 'node:fs';

const dir = 'docs/quotes-work';
const batchSlugs = new Set(
  readdirSync(dir).filter((f) => /^batch-\d\d\.json$/.test(f))
    .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).map((q) => q.slug)),
);
const errors = [];
const seen = new Set();
for (const f of readdirSync(dir).filter((f) => /^fa-\d\d\.json$/.test(f))) {
  for (const t of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'))) {
    if (!batchSlugs.has(t.slug)) errors.push(`${t.slug}: not in batches`);
    if (seen.has(t.slug)) errors.push(`duplicate ${t.slug}`);
    seen.add(t.slug);
    for (const field of ['fa', 'author_fa', 'source_fa'])
      if (!t[field]?.trim()) errors.push(`${t.slug}: empty ${field}`);
    if (!/[؀-ۿ]/.test(t.fa ?? '')) errors.push(`${t.slug}: fa has no Arabic-script text`);
    if (/[0-9]/.test(t.source_fa ?? '')) errors.push(`${t.slug}: source_fa uses Latin digits`);
  }
}
if (seen.size !== batchSlugs.size) errors.push(`translated ${seen.size} ≠ ${batchSlugs.size}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`fa ok: ${seen.size} translations`);
```

- [ ] **Step 2: Translate via parallel subagents** (one per batch). Prompt requirements: natural literary Farsi (register of the existing quotes — see current `Site/public/quotes.json` for tone); `author_fa` from roster `name_fa`; `source_fa` = Persian rendering of the work title with Persian digits (e.g. `Meditations X.6` → «تأملات، دفتر ۱۰، بند ۶»); use established Persian titles where the work has one (published Persian translations of classics).

- [ ] **Step 3: Validate**

Run: `node Site/scripts/validate-fa.mjs`
Expected: `fa ok: 366 translations`.

- [ ] **Step 4: Commit**

```bash
git add docs/quotes-work/fa-*.json Site/scripts/validate-fa.mjs
git commit -m "feat(quotes): Farsi translations with localized source references"
```

---

### Task 5: Assembly + `source_fa` code cutover

**Files:**
- Create: `Site/scripts/assemble-quotes.mjs`
- Create: `docs/quotes-audit.json` (generated)
- Modify: `Site/public/quotes.json` (generated, replaces current content)
- Modify: `Site/src/quotes/quotes.ts` (interface + validator)
- Modify: `Site/src/main.ts:66` (renderQuote author line)
- Modify: `Site/tests/quotes.test.ts`

**Interfaces:**
- Consumes: all `docs/quotes-work/` artifacts.
- Produces: shipped `Quote` shape `{ d, en, fa, author_en, author_fa, source, source_fa }`; `quotes.ts` exports `Quote` with `source_fa: string` (non-optional).

- [ ] **Step 1: Update the tests first** — in `Site/tests/quotes.test.ts`, replace the `every entry has non-empty bilingual fields` test and add uniqueness:

```ts
  it('every entry has non-empty bilingual fields incl. source_fa', () => {
    for (const q of quotes) {
      for (const field of [q.en, q.fa, q.author_en, q.author_fa, q.source, q.source_fa] as const) {
        expect(field.trim().length, `d=${q.d}`).toBeGreaterThan(0);
      }
      expect(q.en.length, `d=${q.d} too long`).toBeLessThanOrEqual(200);
    }
  });
  it('has 366 unique authors — one quote per thinker', () => {
    expect(new Set(quotes.map((q) => q.author_en)).size).toBe(366);
  });
```

Run: `cd Site && npm test` → expect FAIL (current data: 3 authors, no `source_fa`, entries >200 chars).

- [ ] **Step 2: Extend the type and validator** — `Site/src/quotes/quotes.ts`: add `source_fa: string;` to the `Quote` interface and `'source_fa'` to `TEXT_FIELDS`.

- [ ] **Step 3: Localize the citation line** — `Site/src/main.ts` line 66, replace with:

```ts
  text('quote-author', lang === 'fa' ? `${quote.author_fa} — ${quote.source_fa}` : `${quote.author_en} — ${quote.source}`);
```

- [ ] **Step 4: Write the assembly script** — `Site/scripts/assemble-quotes.mjs`:

```js
// Merges docs/quotes-work artifacts into the shipped quotes.json + audit file.
// Deterministic: seeded shuffle (mulberry32, seed 1405) assigns d 1..366 so
// traditions spread across the year and reruns are reproducible.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dir = 'docs/quotes-work';
const load = (re) => readdirSync(dir).filter((f) => re.test(f)).sort()
  .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const roster = JSON.parse(readFileSync(`${dir}/roster.json`, 'utf8'));
const nameBySlug = new Map(roster.map((t) => [t.slug, t.name_en]));
const faBySlug = new Map(load(/^fa-\d\d\.json$/).map((t) => [t.slug, t]));
const research = load(/^batch-\d\d\.json$/);

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rand = mulberry32(1405);
const shuffled = [...research].sort((a, b) => a.slug.localeCompare(b.slug));
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

const quotes = shuffled.map((q, i) => {
  const fa = faBySlug.get(q.slug);
  if (!fa) throw new Error(`no translation for ${q.slug}`);
  return { d: i + 1, en: q.en, fa: fa.fa, author_en: nameBySlug.get(q.slug),
    author_fa: fa.author_fa, source: q.source, source_fa: fa.source_fa };
});
const audit = shuffled.map((q, i) => ({ d: i + 1, slug: q.slug, author_en: nameBySlug.get(q.slug),
  source: q.source, evidence_url: q.evidence_url, evidence_note: q.evidence_note ?? '' }));

writeFileSync('Site/public/quotes.json', JSON.stringify(quotes, null, 1) + '\n');
writeFileSync('docs/quotes-audit.json', JSON.stringify(audit, null, 1) + '\n');
console.log(`wrote ${quotes.length} quotes + audit`);
```

Run from the repo root: `node Site/scripts/assemble-quotes.mjs`
Expected: `wrote 366 quotes + audit`.

- [ ] **Step 5: Run everything**

Run: `cd Site && npm run build && npm test && npm run e2e`
Expected: ALL PASS (the e2e `daily quote appears` test now renders a new-roster quote; check it visually in the screenshots, en and fa).

- [ ] **Step 6: Commit**

```bash
git add Site/public/quotes.json docs/quotes-audit.json Site/scripts/assemble-quotes.mjs Site/src/quotes/quotes.ts Site/src/main.ts Site/tests/quotes.test.ts
git commit -m "feat(quotes): 366 unique thinkers with verified citations; localized source_fa"
```

---

### Task 6: README + human-review sample

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`** — quotes section: 366 unique thinkers, one per person; secular; primary-source verified with evidence in `docs/quotes-audit.json`; pipeline artifacts in `docs/quotes-work/`; regeneration via the three validate scripts + `assemble-quotes.mjs`. Carry over the open item: *Farsi translations pending native-speaker proofread*.

- [ ] **Step 2: Produce Ali's review sample** — print 15 seeded-random entries (en + fa + source lines) plus the full 366-author list for a skim. This is the human gate before any deploy.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: quote roster provenance, audit trail, proofread open item"
```
