export const IR_SOLAR_KEYS = [
  'ir.nowruz', 'ir.republic', 'ir.nature', 'ir.khomeini', 'ir.uprising', 'ir.revolution', 'ir.oil',
] as const;

export const IR_LUNAR_KEYS = [
  'ir.tasua', 'ir.ashura', 'ir.arbaeen', 'ir.prophet', 'ir.reza', 'ir.askari', 'ir.mawlid',
  'ir.fatima', 'ir.ali-birth', 'ir.mabath', 'ir.mahdi', 'ir.ali-martyrdom', 'ir.fitr',
  'ir.sadiq', 'ir.adha', 'ir.ghadir',
] as const;

export const BY_KEYS = [
  'by.new-year', 'by.epiphany', 'by.good-friday', 'by.easter-monday', 'by.labour',
  'by.ascension', 'by.whit-monday', 'by.corpus-christi', 'by.unity', 'by.all-saints',
  'by.christmas', 'by.boxing',
] as const;

export type IrSolarKey = typeof IR_SOLAR_KEYS[number];
export type IrLunarKey = typeof IR_LUNAR_KEYS[number];
export type ByKey = typeof BY_KEYS[number];
export type HolidayKey = IrSolarKey | IrLunarKey | ByKey;

export const ALL_HOLIDAY_KEYS: readonly HolidayKey[] = [...IR_SOLAR_KEYS, ...IR_LUNAR_KEYS, ...BY_KEYS];

export const isIrLunarKey = (value: unknown): value is IrLunarKey =>
  (IR_LUNAR_KEYS as readonly unknown[]).includes(value);
