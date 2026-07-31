import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import 'vazirmatn/Vazirmatn-Variable-font-face.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { nowSnapshot } from './calendar/now';
import { persianDayOfYear } from './calendar/persian';
import { setupConverter } from './converter/converter';
import {
  GREGORIAN_MONTHS, initialLang, PERSIAN_MONTHS, persistLang, STRINGS,
  toLocaleDigits, type Lang,
} from './i18n/strings';
import { loadQuotes, quoteForPersianDay, type Quote } from './quotes/quotes';
import { createClock } from './clock/clock';

let lang: Lang = initialLang();
let quotes: readonly Quote[] | null = null;

function text(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderStatic(): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.title = STRINGS[lang].pageTitle;
  text('lang-toggle', STRINGS[lang].langToggle);
  text('legend-persian', STRINGS[lang].persianLabel);
  text('legend-gregorian', STRINGS[lang].gregorianLabel);
  for (const span of document.querySelectorAll<HTMLElement>('[data-str]')) {
    const key = span.dataset['str'] as keyof typeof STRINGS.en;
    span.textContent = STRINGS[lang][key];
  }
}

function renderToday(): void {
  const snapshot = nowSnapshot();
  const p = snapshot.local.p;
  const g = snapshot.local.g;
  const pText = `${toLocaleDigits(p.pd, lang)} ${PERSIAN_MONTHS[lang][p.pm - 1]} ${toLocaleDigits(p.py, lang)}`;
  const gText = `${GREGORIAN_MONTHS[lang][g.gm - 1]} ${toLocaleDigits(g.gd, lang)}, ${toLocaleDigits(g.gy, lang)}`;
  text('today-persian', pText);
  text('today-gregorian', gText);
  const tehranLine = document.getElementById('tehran-line');
  if (tehranLine) {
    tehranLine.hidden = snapshot.tehranIsLocal;
    tehranLine.textContent = `${STRINGS[lang].tehranLabel} ${toLocaleDigits(snapshot.tehran.hhmm, lang)}`;
  }
}

function renderQuote(): void {
  const container = document.getElementById('quote');
  if (!container || quotes === null) return;
  const day = persianDayOfYear(nowSnapshot().local.p);
  const quote = quoteForPersianDay(day, quotes);
  if (!quote) return;
  text('quote-text', lang === 'fa' ? quote.fa : quote.en);
  text('quote-author', lang === 'fa' ? `${quote.author_fa} — ${quote.source}` : `${quote.author_en} — ${quote.source}`);
  container.hidden = false;
}

function renderAll(converterRerender: () => void): void {
  renderStatic();
  renderToday();
  renderQuote();
  converterRerender();
}

const converter = setupConverter(() => lang);
const today = nowSnapshot();
converter.prefill(today.local.p, today.local.g);
renderStatic();
renderToday();

const clockMount = document.getElementById('clock-mount');
if (clockMount) createClock(clockMount);

document.getElementById('lang-toggle')?.addEventListener('click', () => {
  lang = lang === 'en' ? 'fa' : 'en';
  persistLang(lang);
  renderAll(converter.rerender);
});

void loadQuotes().then((loaded) => {
  quotes = loaded;
  renderQuote();
});
