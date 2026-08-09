import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import 'vazirmatn/Vazirmatn-Variable-font-face.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { nowSnapshot } from './calendar/now';
import { todayLines } from './calendar/today-lines';
import { setupConverter } from './converter/converter';
import { convertFrom } from './converter/converter-core';
import { parseUrlDate } from './converter/url-state';
import {
  initialLang, persistLang, STRINGS,
  toLocaleDigits, type Lang, type StringKey,
} from './i18n/strings';
import { formatGregorianDate, formatPersianDate, weekdayName } from './i18n/format';
import { createClock } from './clock/clock';

let lang: Lang = initialLang();

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
  const dictionary = STRINGS[lang];
  for (const span of document.querySelectorAll<HTMLElement>('[data-str]')) {
    const key = span.dataset['str'];
    // Unknown or missing keys are markup bugs, not runtime data — skip rather
    // than writing "undefined" into the page.
    if (key === undefined || !Object.hasOwn(dictionary, key)) continue;
    span.textContent = dictionary[key as StringKey];
  }
}

function renderToday(): void {
  const snapshot = nowSnapshot();
  const lines = todayLines(snapshot);
  const sep = lang === 'fa' ? ' ' : ', ';
  const persianWeekday = weekdayName(lines.persianWeekdaySource, lang);
  text('today-persian', `${persianWeekday}${sep}${formatPersianDate(lines.persian, lang)}`);
  // The second weekday would just repeat the first: both lines describe one day,
  // except when Tehran has turned over and the viewer has not.
  const gregorianWeekday = lines.daysDiverge
    ? `${weekdayName(lines.gregorian, lang)}${sep}`
    : '';
  text('today-gregorian', `${gregorianWeekday}${formatGregorianDate(lines.gregorian, lang)}`);
  const tehranLine = document.getElementById('tehran-line');
  if (tehranLine) {
    tehranLine.hidden = snapshot.tehranIsLocal;
    tehranLine.textContent = `${STRINGS[lang].tehranLabel} ${toLocaleDigits(snapshot.tehran.hhmm, lang)}`;
  }
}

function renderAll(converterRerender: () => void): void {
  renderStatic();
  renderToday();
  converterRerender();
}

const converter = setupConverter(() => lang);
const urlDate = parseUrlDate(window.location.search);
const urlOutcome = urlDate === null ? null : convertFrom(urlDate.side, {
  y: String(urlDate.y), m: String(urlDate.m), d: String(urlDate.d),
});
if (urlOutcome?.status === 'ok') {
  converter.prefill(urlOutcome.persian, urlOutcome.gregorian);
} else {
  // No param, or an invalid one — ignore silently and show today.
  const today = nowSnapshot();
  converter.prefill(today.local.p, today.local.g);
}
renderStatic();
renderToday();

const clockMount = document.getElementById('clock-mount');
if (clockMount) createClock(clockMount);

document.getElementById('lang-toggle')?.addEventListener('click', () => {
  lang = lang === 'en' ? 'fa' : 'en';
  persistLang(lang);
  renderAll(converter.rerender);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Registration failure is silent-degrade: the site works exactly as before.
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
