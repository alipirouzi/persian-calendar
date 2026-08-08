export type Lang = 'en' | 'fa';

export type StringKey =
  | 'pageTitle' | 'persianLabel' | 'gregorianLabel'
  | 'year' | 'month' | 'day' | 'tehranLabel' | 'langToggle'
  | 'today' | 'copy' | 'copied' | 'copyFailed'
  | 'chooseMonth' | 'chooseDay'
  | 'chooseYear' | 'openCalendar' | 'prevMonth' | 'nextMonth'
  | 'errYearRange' | 'errMonth' | 'errDay' | 'errUnsupported';

export const STRINGS: Record<Lang, Record<StringKey, string>> = {
  en: {
    pageTitle: 'Persian Calendar',
    persianLabel: 'Persian (Shamsi)',
    gregorianLabel: 'Gregorian',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    tehranLabel: 'Tehran',
    langToggle: 'فارسی',
    today: 'Today',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    chooseMonth: 'Choose month',
    chooseDay: 'Choose day',
    chooseYear: 'Choose year',
    openCalendar: 'Open calendar',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    errYearRange: 'Year must be between {min} and {max}',
    errMonth: 'Month must be between 1 and 12',
    errDay: '{month} has {days} days in {year}',
    errUnsupported: 'That date is outside the supported range',
  },
  fa: {
    pageTitle: 'تقویم فارسی',
    persianLabel: 'شمسی',
    gregorianLabel: 'میلادی',
    year: 'سال',
    month: 'ماه',
    day: 'روز',
    tehranLabel: 'تهران',
    langToggle: 'English',
    today: 'امروز',
    copy: 'کپی',
    copied: 'کپی شد',
    copyFailed: 'کپی نشد',
    chooseMonth: 'انتخاب ماه',
    chooseDay: 'انتخاب روز',
    chooseYear: 'انتخاب سال',
    openCalendar: 'تقویم',
    prevMonth: 'ماه قبل',
    nextMonth: 'ماه بعد',
    errYearRange: 'سال باید بین {min} و {max} باشد',
    errMonth: 'ماه باید بین ۱ و ۱۲ باشد',
    errDay: '{month} در سال {year} {days} روز دارد',
    errUnsupported: 'این تاریخ خارج از محدوده پشتیبانی‌شده است',
  },
};

export const PERSIAN_MONTHS: Record<Lang, readonly string[]> = {
  en: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
    'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'],
  fa: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
};

export const GREGORIAN_MONTHS: Record<Lang, readonly string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'],
  fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'می', 'ژوئن',
    'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
};

/** Indexed by JS Date.getDay(): 0 = Sunday … 6 = Saturday. */
export const WEEKDAYS: Record<Lang, readonly string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
};

/** Short weekday labels for the calendar header, indexed like WEEKDAYS. */
export const WEEKDAYS_SHORT: Record<Lang, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  fa: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'],
};

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

export function toLocaleDigits(value: string | number, lang: Lang): string {
  const s = String(value);
  if (lang !== 'fa') return s;
  return s.replace(/[0-9]/g, (c) => FA_DIGITS[Number(c)] as string);
}

export function formatTemplate(
  template: string,
  params: Record<string, string | number>,
  lang: Lang,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = params[key];
    return v === undefined ? whole : toLocaleDigits(v, lang);
  });
}

const LANG_STORAGE_KEY = 'lang';

export function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'fa') return stored;
  } catch { /* private mode — fall through */ }
  return navigator.language.toLowerCase().startsWith('fa') ? 'fa' : 'en';
}

export function persistLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch { /* private mode — session-only */ }
}
