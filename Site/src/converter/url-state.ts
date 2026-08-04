import type { Side } from './converter-core';

export interface UrlDate { side: Side; y: number; m: number; d: number }

const DATE_RE = /^(\d{1,4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Structural parse of ?p=Y-M-D or ?g=Y-M-D. Exactly one of p/g must be
 * present. Range validation is deliberately left to convertFrom.
 */
export function parseUrlDate(search: string): UrlDate | null {
  const params = new URLSearchParams(search);
  const p = params.get('p');
  const g = params.get('g');
  if ((p === null) === (g === null)) return null; // need exactly one side
  const match = DATE_RE.exec((p ?? g) as string);
  if (!match) return null;
  return {
    side: p !== null ? 'persian' : 'gregorian',
    y: Number(match[1]), m: Number(match[2]), d: Number(match[3]),
  };
}

export function formatUrlQuery(side: Side, y: number, m: number, d: number): string {
  return `?${side === 'persian' ? 'p' : 'g'}=${y}-${m}-${d}`;
}
