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
import { createSettingsStore } from './settings/settings-store';
import { setupSettingsPanel } from './settings/settings-panel';
import { createTimeSource } from './time/time-source';
import { setupTimeSettings } from './time/time-panel';
import { setupWatchSettings } from './watch/watch-settings';
import { createWatch } from './watch/watch';
import { createMinuteGate } from './time/minute-gate';
import { createHolidayService } from './holidays/holiday-service';
import { setupCalendarPanels } from './views/calendar-panels';
import { setupHolidaySettings } from './holidays/holidays-panel';

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
  const snapshot = nowSnapshot(time.now());
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
  settingsPanel.rerender();
  timeSettings.rerender();
  holidaySettings.rerender();
  watchSettings.rerender();
  watch.rerender();
  panels.rerender();
}

const settings = createSettingsStore();
const time = createTimeSource({ store: settings });
const converter = setupConverter(() => lang, () => settings.get().copy, time.now);
const settingsPanel = setupSettingsPanel({
  store: settings, getLang: () => lang, getDate: () => converter.current(),
});
const timeSettings = setupTimeSettings({ store: settings, time, getLang: () => lang });
const watchSettings = setupWatchSettings({ store: settings, getLang: () => lang });
// The Copy tooltip names the active format; keep it in step with the settings.
settings.subscribe(() => { converter.rerender(); });
const urlDate = parseUrlDate(window.location.search);
const urlOutcome = urlDate === null ? null : convertFrom(urlDate.side, {
  y: String(urlDate.y), m: String(urlDate.m), d: String(urlDate.d),
});
if (urlOutcome?.status === 'ok') {
  converter.prefill(urlOutcome.persian, urlOutcome.gregorian);
} else {
  // No param, or an invalid one — ignore silently and show today.
  const today = nowSnapshot(time.now());
  converter.prefill(today.local.p, today.local.g);
}
const holidayService = createHolidayService({ store: settings });
const panels = setupCalendarPanels({
  store: settings,
  holidays: holidayService,
  getLang: () => lang,
  now: time.now,
  onPickDay: (p, g) => {
    converter.prefill(p, g);
    document.getElementById('converter')?.scrollIntoView({ block: 'nearest' });
  },
});
holidayService.subscribe(() => { panels.rerender(); });
const holidaySettings = setupHolidaySettings({ store: settings, service: holidayService, getLang: () => lang, now: time.now });
renderStatic();
renderToday();

// The today panel is re-rendered once a minute from the watch's own frames: that covers
// local midnight, Tehran midnight and the Tehran time line, with no long timer for iOS to
// throttle. A watch that was hidden restarts on visible and ticks straight away.
const refreshToday = createMinuteGate(() => { renderToday(); panels.refreshToday(); });
const watch = createWatch(document.getElementById('clock-section')!, {
  now: time.now, onTick: refreshToday, getFace: () => settings.get().watch.face, getLang: () => lang,
});
settings.subscribe((s) => { watch.setFace(s.watch.face); });
// A sync can move "now" across a minute or a day; re-check as soon as it lands.
time.subscribe(() => { refreshToday(time.now()); });
time.start();

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
