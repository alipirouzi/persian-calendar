import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';
import {
  GREGORIAN_MONTHS, PERSIAN_MONTHS, toLocaleDigits, WEEKDAYS, type Lang,
} from './strings';

export function weekdayName(g: GregorianDateParts, lang: Lang): string {
  const day = new Date(g.gy, g.gm - 1, g.gd).getDay();
  return WEEKDAYS[lang][day] as string;
}

export function formatPersianDate(p: PersianDateParts, lang: Lang): string {
  return `${toLocaleDigits(p.pd, lang)} ${PERSIAN_MONTHS[lang][p.pm - 1]} ${toLocaleDigits(p.py, lang)}`;
}

export function formatGregorianDate(g: GregorianDateParts, lang: Lang): string {
  return lang === 'fa'
    ? `${toLocaleDigits(g.gd, lang)} ${GREGORIAN_MONTHS[lang][g.gm - 1]} ${toLocaleDigits(g.gy, lang)}`
    : `${GREGORIAN_MONTHS[lang][g.gm - 1]} ${g.gd}, ${g.gy}`;
}

/** Full shareable sentence, e.g. "Saturday, 22 Dey 1403 — January 11, 2025". */
export function copySentence(p: PersianDateParts, g: GregorianDateParts, lang: Lang): string {
  const w = weekdayName(g, lang);
  const sep = lang === 'fa' ? ' ' : ', ';
  return `${w}${sep}${formatPersianDate(p, lang)} — ${formatGregorianDate(g, lang)}`;
}
