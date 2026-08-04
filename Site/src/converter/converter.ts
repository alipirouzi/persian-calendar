import { convertFrom, type Side } from './converter-core';
import { formatUrlQuery } from './url-state';
import { nowSnapshot } from '../calendar/now';
import { copySentence, weekdayName } from '../i18n/format';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, toLocaleDigits, type Lang,
} from '../i18n/strings';
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';

const COPIED_RESET_MS = 1500;

interface Refs {
  persian: { y: HTMLInputElement; m: HTMLSelectElement; d: HTMLInputElement };
  gregorian: { y: HTMLInputElement; m: HTMLSelectElement; d: HTMLInputElement };
  error: HTMLElement;
  weekday: HTMLElement;
  btnToday: HTMLButtonElement;
  btnCopy: HTMLButtonElement;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function populateMonths(select: HTMLSelectElement, names: readonly string[]): void {
  const current = select.value;
  select.replaceChildren(...names.map((name, i) => {
    const option = document.createElement('option');
    option.value = String(i + 1);
    option.textContent = name;
    return option;
  }));
  select.value = current !== '' ? current : '1';
}

export function setupConverter(getLang: () => Lang): {
  prefill: (p: PersianDateParts, g: GregorianDateParts) => void;
  rerender: () => void;
} {
  const refs: Refs = {
    persian: { y: byId('p-y'), m: byId('p-m'), d: byId('p-d') },
    gregorian: { y: byId('g-y'), m: byId('g-m'), d: byId('g-d') },
    error: byId('converter-error'),
    weekday: byId('weekday'),
    btnToday: byId('btn-today'),
    btnCopy: byId('btn-copy'),
  };
  let lastEdited: Side = 'persian';
  let lastOk: { p: PersianDateParts; g: GregorianDateParts } | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const setSide = (side: Side, p: PersianDateParts, g: GregorianDateParts): void => {
    const lang = getLang();
    if (side === 'persian') {
      refs.persian.y.value = toLocaleDigits(p.py, lang);
      refs.persian.m.value = String(p.pm);
      refs.persian.d.value = toLocaleDigits(p.pd, lang);
    } else {
      refs.gregorian.y.value = toLocaleDigits(g.gy, lang);
      refs.gregorian.m.value = String(g.gm);
      refs.gregorian.d.value = toLocaleDigits(g.gd, lang);
    }
  };

  const showError = (message: string | null): void => {
    refs.error.hidden = message === null;
    refs.error.textContent = message ?? '';
  };

  const setStatus = (ok: { p: PersianDateParts; g: GregorianDateParts } | null): void => {
    lastOk = ok;
    refs.weekday.textContent = ok ? weekdayName(ok.g, getLang()) : '';
    refs.btnCopy.disabled = ok === null;
  };

  const run = (source: Side, updateUrl: boolean): void => {
    lastEdited = source;
    const lang = getLang();
    const f = refs[source];
    const outcome = convertFrom(source, { y: f.y.value, m: f.m.value, d: f.d.value });
    if (outcome.status === 'ok') {
      setSide(source === 'persian' ? 'gregorian' : 'persian', outcome.persian, outcome.gregorian);
      showError(null);
      setStatus({ p: outcome.persian, g: outcome.gregorian });
      if (updateUrl) {
        const { p, g } = { p: outcome.persian, g: outcome.gregorian };
        const query = source === 'persian'
          ? formatUrlQuery('persian', p.py, p.pm, p.pd)
          : formatUrlQuery('gregorian', g.gy, g.gm, g.gd);
        history.replaceState(null, '', query);
      }
      return;
    }
    setStatus(null);
    if (outcome.status === 'incomplete') {
      showError(null);
      return;
    }
    const params = { ...outcome.params };
    if (outcome.errorKey === 'errDay') {
      const months = outcome.side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
      (params as Record<string, string | number>)['month'] = months[(outcome.params['month'] as number) - 1] as string;
    }
    showError(formatTemplate(STRINGS[lang][outcome.errorKey], params, lang));
  };

  const prefill = (p: PersianDateParts, g: GregorianDateParts): void => {
    setSide('persian', p, g);
    setSide('gregorian', p, g);
    showError(null);
    setStatus({ p, g });
  };

  const renderMonths = (): void => {
    const lang = getLang();
    populateMonths(refs.persian.m, PERSIAN_MONTHS[lang]);
    populateMonths(refs.gregorian.m, GREGORIAN_MONTHS[lang]);
  };
  renderMonths();

  for (const side of ['persian', 'gregorian'] as const) {
    refs[side].y.addEventListener('input', () => run(side, true));
    refs[side].d.addEventListener('input', () => run(side, true));
    refs[side].m.addEventListener('change', () => run(side, true));
  }

  refs.btnToday.addEventListener('click', () => {
    const snap = nowSnapshot();
    prefill(snap.local.p, snap.local.g);
    history.replaceState(null, '', window.location.pathname);
  });

  const flashCopyLabel = (key: 'copied' | 'copyFailed'): void => {
    const lang = getLang();
    refs.btnCopy.textContent = STRINGS[lang][key];
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      refs.btnCopy.textContent = STRINGS[getLang()].copy;
    }, COPIED_RESET_MS);
  };

  refs.btnCopy.addEventListener('click', () => {
    if (lastOk === null) return;
    const lang = getLang();
    navigator.clipboard.writeText(copySentence(lastOk.p, lastOk.g, lang))
      .then(() => flashCopyLabel('copied'))
      .catch(() => flashCopyLabel('copyFailed'));
  });

  return {
    prefill,
    rerender: () => {
      renderMonths();
      // Own the copy button's label regardless of caller ordering: a pending
      // "Copied"/"Copy failed" flash must not survive a language toggle.
      clearTimeout(copiedTimer);
      refs.btnCopy.textContent = STRINGS[getLang()].copy;
      // Language switch: refresh digits/labels on BOTH sides from the last
      // valid state (the user is not mid-typing during a toggle).
      if (lastOk !== null) {
        setSide('persian', lastOk.p, lastOk.g);
        setSide('gregorian', lastOk.p, lastOk.g);
        setStatus(lastOk);
        showError(null);
      } else {
        run(lastEdited, false);
      }
    },
  };
}
