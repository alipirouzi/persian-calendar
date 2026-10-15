import type { PersianDateParts } from '../calendar/persian';
import type { IrLunarKey, IrSolarKey } from './holiday-keys';

export interface PersianHoliday {
  readonly p: PersianDateParts;
  readonly key: IrSolarKey | IrLunarKey;
}

const SOLAR: readonly (readonly [month: number, day: number, key: IrSolarKey])[] = [
  [1, 1, 'ir.nowruz'], [1, 2, 'ir.nowruz'], [1, 3, 'ir.nowruz'], [1, 4, 'ir.nowruz'],
  [1, 12, 'ir.republic'], [1, 13, 'ir.nature'],
  [3, 14, 'ir.khomeini'], [3, 15, 'ir.uprising'],
  [11, 22, 'ir.revolution'], [12, 29, 'ir.oil'],
];

/** The Iranian public holidays fixed to the solar calendar, in date order. */
export function irSolarHolidays(py: number): readonly PersianHoliday[] {
  return SOLAR.map(([pm, pd, key]) => ({ p: { py, pm, pd }, key }));
}
