import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';
import { copySentence, weekdayName } from '../i18n/format';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import { SENTENCE, type CopyDigits, type CopySettings } from '../settings/settings-model';

type Field = 'yyyy' | 'MMMM' | 'dddd' | 'mm' | 'dd' | 'm' | 'd';
export type Token = { kind: 'literal'; text: string } | { kind: 'field'; field: Field };

/** Longest first, so `mm` is never read as two `m`s. */
const FIELDS: readonly Field[] = ['yyyy', 'MMMM', 'dddd', 'mm', 'dd', 'm', 'd'];
const QUOTE = "'";

export function tokenize(pattern: string): Token[] {
  const tokens: Token[] = [];
  let literal = '';
  const flush = (): void => {
    if (literal !== '') tokens.push({ kind: 'literal', text: literal });
    literal = '';
  };
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === QUOTE) {
      // Quoted text is copied as typed; an unterminated quote runs to the end.
      const close = pattern.indexOf(QUOTE, i + 1);
      const end = close === -1 ? pattern.length : close;
      literal += pattern.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    const field = FIELDS.find((candidate) => pattern.startsWith(candidate, i));
    if (field === undefined) {
      literal += pattern.charAt(i);
      i += 1;
      continue;
    }
    flush();
    tokens.push({ kind: 'field', field });
    i += field.length;
  }
  flush();
  return tokens;
}

interface DateFields { year: number; month: number; day: number; monthName: string; weekday: string }

function render(tokens: readonly Token[], date: DateFields, digits: CopyDigits): string {
  const number = (value: number, width: number): string =>
    toLocaleDigits(String(value).padStart(width, '0'), digits === 'persian' ? 'fa' : 'en');
  const fields: Record<Field, () => string> = {
    yyyy: () => number(date.year, 4),
    mm: () => number(date.month, 2),
    m: () => number(date.month, 1),
    dd: () => number(date.day, 2),
    d: () => number(date.day, 1),
    MMMM: () => date.monthName,
    dddd: () => date.weekday,
  };
  return tokens.map((t) => (t.kind === 'literal' ? t.text : fields[t.field]())).join('');
}

/** What the Copy button writes for this date under these settings. */
export function formatCopy(
  p: PersianDateParts, g: GregorianDateParts, copy: CopySettings, lang: Lang,
): string {
  if (copy.pattern === SENTENCE) return copySentence(p, g, lang);
  const tokens = tokenize(copy.pattern);
  const weekday = weekdayName(g, lang);
  const persian = render(tokens, {
    year: p.py, month: p.pm, day: p.pd, monthName: PERSIAN_MONTHS[lang][p.pm - 1] as string, weekday,
  }, copy.digits);
  const gregorian = render(tokens, {
    year: g.gy, month: g.gm, day: g.gd, monthName: GREGORIAN_MONTHS[lang][g.gm - 1] as string, weekday,
  }, copy.digits);
  if (copy.calendar === 'persian') return persian;
  if (copy.calendar === 'gregorian') return gregorian;
  return `${persian} / ${gregorian}`;
}

/** Short description of the active format, for the Copy button's tooltip. */
export function patternLabel(copy: CopySettings, lang: Lang): string {
  return copy.pattern === SENTENCE ? STRINGS[lang].patternSentence : copy.pattern;
}
