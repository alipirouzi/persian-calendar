import { convertFrom, type Side } from './converter-core';
import {
  formatTemplate, GREGORIAN_MONTHS, PERSIAN_MONTHS, STRINGS, type Lang,
} from '../i18n/strings';
import type { GregorianDateParts, PersianDateParts } from '../calendar/persian';

interface Refs {
  persian: { y: HTMLInputElement; m: HTMLInputElement; d: HTMLInputElement };
  gregorian: { y: HTMLInputElement; m: HTMLInputElement; d: HTMLInputElement };
  error: HTMLElement;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

export function setupConverter(getLang: () => Lang): {
  prefill: (p: PersianDateParts, g: GregorianDateParts) => void;
  rerender: () => void;
} {
  const refs: Refs = {
    persian: { y: byId('p-y'), m: byId('p-m'), d: byId('p-d') },
    gregorian: { y: byId('g-y'), m: byId('g-m'), d: byId('g-d') },
    error: byId('converter-error'),
  };
  let lastEdited: Side = 'persian';

  const setSide = (side: Side, p: PersianDateParts, g: GregorianDateParts): void => {
    if (side === 'persian') {
      refs.persian.y.value = String(p.py);
      refs.persian.m.value = String(p.pm);
      refs.persian.d.value = String(p.pd);
    } else {
      refs.gregorian.y.value = String(g.gy);
      refs.gregorian.m.value = String(g.gm);
      refs.gregorian.d.value = String(g.gd);
    }
  };

  const showError = (message: string | null): void => {
    refs.error.hidden = message === null;
    refs.error.textContent = message ?? '';
  };

  const run = (source: Side): void => {
    lastEdited = source;
    const lang = getLang();
    const f = refs[source];
    const outcome = convertFrom(source, { y: f.y.value, m: f.m.value, d: f.d.value });
    if (outcome.status === 'ok') {
      setSide(source === 'persian' ? 'gregorian' : 'persian', outcome.persian, outcome.gregorian);
      showError(null);
      return;
    }
    if (outcome.status === 'incomplete') {
      showError(null);
      return;
    }
    const params = { ...outcome.params };
    if (outcome.errorKey === 'errDay') {
      const months = outcome.side === 'persian' ? PERSIAN_MONTHS[lang] : GREGORIAN_MONTHS[lang];
      // month name substitutes the numeric index for the message
      (params as Record<string, string | number>)['month'] = months[(outcome.params['month'] as number) - 1] as string;
    }
    showError(formatTemplate(STRINGS[lang][outcome.errorKey], params, lang));
  };

  for (const side of ['persian', 'gregorian'] as const) {
    for (const input of Object.values(refs[side])) {
      input.addEventListener('input', () => run(side));
    }
  }

  return {
    prefill: (p, g) => {
      setSide('persian', p, g);
      setSide('gregorian', p, g);
      showError(null);
    },
    rerender: () => run(lastEdited),
  };
}
