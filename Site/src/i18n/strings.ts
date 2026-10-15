import type { HolidayKey } from '../holidays/holiday-keys';

export type Lang = 'en' | 'fa';

export type StringKey =
  | 'pageTitle' | 'persianLabel' | 'gregorianLabel'
  | 'year' | 'month' | 'day' | 'tehranLabel' | 'langToggle'
  | 'today' | 'copy' | 'copied' | 'copyFailed'
  | 'chooseMonth' | 'chooseDay'
  | 'chooseYear' | 'openCalendar'
  // One pair per calendar view: the step buttons show only ‹ and ›, so their
  // label is the whole accessible name and has to say what a step moves.
  | 'prevMonth' | 'nextMonth' | 'prevYear' | 'nextYear' | 'prevYears' | 'nextYears'
  | 'errYearRange' | 'errMonth' | 'errDay' | 'errUnsupported'
  | 'patternSentence'
  | 'settings' | 'close' | 'copySection' | 'copyCalendar' | 'calPersian' | 'calGregorian' | 'calBoth'
  | 'copyPattern' | 'patternCustom' | 'patternCustomLabel' | 'patternHint'
  | 'copyDigits' | 'digitsLatin' | 'digitsPersian' | 'copyPreview'
  | 'timeSection' | 'timeSourceLabel' | 'sourceDevice' | 'testConnection' | 'testing'
  | 'testOk' | 'testFail' | 'statusDevice' | 'statusSyncing' | 'statusSynced' | 'statusUnsynced'
  | 'driftNone' | 'driftSlow' | 'driftFast' | 'driftSlowMin' | 'driftFastMin'
  | 'viewPersian' | 'viewGregorian' | 'sourceIr' | 'sourceNuremberg' | 'sourceUser'
  | 'estimated' | 'noHolidays' | 'goToThisMonth' | 'calendarsLabel'
  | 'holidaysSection' | 'viewsLabel' | 'holidaySourcesLabel' | 'sourceIrLong' | 'sourceNurembergLong' | 'sourceUserLong'
  | 'holidayName' | 'holidayYear' | 'everyYear' | 'holidayAdd' | 'holidaySave' | 'holidayCancel' | 'holidayEdit' | 'holidayDelete'
  | 'holidayInvalid' | 'holidayLimit' | 'noUserHolidays' | 'holidaysTestOk' | 'holidaysTestNone'
  | 'watchSection' | 'watchFace' | 'faceFullBleed' | 'faceClassic' | 'showMovement' | 'showTime' | 'watchLabel'
  | 'partBarrel' | 'partCentre' | 'partThird' | 'partFourth' | 'partEscape' | 'partPallet' | 'partBalance'
  | 'movementLabel';

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
    prevYear: 'Previous year',
    nextYear: 'Next year',
    prevYears: 'Previous {count} years',
    nextYears: 'Next {count} years',
    errYearRange: 'Year must be between {min} and {max}',
    errMonth: 'Month must be between 1 and 12',
    errDay: '{month} has {days} days in {year}',
    errUnsupported: 'That date is outside the supported range',
    patternSentence: 'Full sentence',
    settings: 'Settings',
    close: 'Close',
    copySection: 'Copy format',
    copyCalendar: 'Calendar',
    calPersian: 'Persian',
    calGregorian: 'Gregorian',
    calBoth: 'Both',
    copyPattern: 'Format',
    patternCustom: 'Custom…',
    patternCustomLabel: 'Custom format',
    patternHint: "yyyy year · mm / m month · dd / d day · MMMM month name · dddd weekday · 'text' as typed",
    copyDigits: 'Digits',
    digitsLatin: 'Latin (0–9)',
    digitsPersian: 'Persian (۰–۹)',
    copyPreview: 'Copies as',
    timeSection: 'Time',
    timeSourceLabel: 'Source',
    sourceDevice: 'This device only',
    testConnection: 'Test connection',
    testing: 'Testing…',
    testOk: 'OK · {rtt} ms · {drift}',
    testFail: 'Unreachable',
    statusDevice: "Using this device's clock",
    statusSyncing: 'Syncing…',
    statusSynced: 'Synced {time} · {drift}',
    statusUnsynced: "Not synced — using this device's clock",
    driftNone: 'device clock accurate',
    driftSlow: 'device {s} s slow',
    driftFast: 'device {s} s fast',
    driftSlowMin: 'device {m} min slow',
    driftFastMin: 'device {m} min fast',
    viewPersian: 'Persian month',
    viewGregorian: 'Gregorian month',
    sourceIr: 'Iran',
    sourceNuremberg: 'Nuremberg',
    sourceUser: 'Mine',
    estimated: 'estimated',
    noHolidays: 'No holidays this month',
    goToThisMonth: 'Today — go to this month',
    calendarsLabel: 'Calendars',
    holidaysSection: 'Calendars & holidays',
    viewsLabel: 'Show under the clock',
    holidaySourcesLabel: 'Holidays',
    sourceIrLong: 'Iran (official)',
    sourceNurembergLong: 'Nuremberg (Bavaria)',
    sourceUserLong: 'My holidays',
    holidayName: 'Name',
    holidayYear: 'Year (optional)',
    everyYear: 'every year',
    holidayAdd: 'Add',
    holidaySave: 'Save',
    holidayCancel: 'Cancel',
    holidayEdit: 'Edit',
    holidayDelete: 'Delete',
    holidayInvalid: 'Enter a name and a date that exists',
    holidayLimit: 'You can keep up to {max} holidays',
    noUserHolidays: 'None yet',
    holidaysTestOk: 'OK · {year} official data · updated {date}',
    holidaysTestNone: 'No official data for {year} — using estimates',
    watchSection: 'Watch',
    watchFace: 'Face',
    faceFullBleed: 'Full bleed',
    faceClassic: 'Classic',
    showMovement: 'Show movement',
    showTime: 'Show time',
    watchLabel: 'Watch, {time}',
    partBarrel: 'Barrel · 1 turn in 8 hours',
    partCentre: 'Centre wheel · 1 turn an hour',
    partThird: 'Third wheel · 8 turns an hour',
    partFourth: 'Fourth wheel · 1 turn a minute',
    partEscape: 'Escape wheel · 16 turns a minute',
    partPallet: 'Pallet fork · 8 beats a second',
    partBalance: 'Balance · 4 Hz',
    movementLabel: 'Watch movement',
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
    prevYear: 'سال قبل',
    nextYear: 'سال بعد',
    prevYears: '{count} سال قبل',
    nextYears: '{count} سال بعد',
    errYearRange: 'سال باید بین {min} و {max} باشد',
    errMonth: 'ماه باید بین ۱ و ۱۲ باشد',
    errDay: '{month} در سال {year} {days} روز دارد',
    errUnsupported: 'این تاریخ خارج از محدوده پشتیبانی‌شده است',
    patternSentence: 'جمله کامل',
    settings: 'تنظیمات',
    close: 'بستن',
    copySection: 'قالب کپی',
    copyCalendar: 'تقویم',
    calPersian: 'شمسی',
    calGregorian: 'میلادی',
    calBoth: 'هر دو',
    copyPattern: 'قالب',
    patternCustom: 'دلخواه…',
    patternCustomLabel: 'قالب دلخواه',
    patternHint: "yyyy سال · mm / m ماه · dd / d روز · MMMM نام ماه · dddd نام روز · 'متن' بدون تغییر",
    copyDigits: 'ارقام',
    digitsLatin: 'لاتین (0–9)',
    digitsPersian: 'فارسی (۰–۹)',
    copyPreview: 'کپی به صورت',
    timeSection: 'زمان',
    timeSourceLabel: 'منبع',
    sourceDevice: 'فقط همین دستگاه',
    testConnection: 'آزمایش اتصال',
    testing: 'در حال آزمایش…',
    testOk: 'برقرار · {rtt} میلی‌ثانیه · {drift}',
    testFail: 'در دسترس نیست',
    statusDevice: 'از ساعت همین دستگاه استفاده می‌شود',
    statusSyncing: 'در حال همگام‌سازی…',
    statusSynced: 'همگام‌شده در {time} · {drift}',
    statusUnsynced: 'همگام نشد — از ساعت همین دستگاه استفاده می‌شود',
    driftNone: 'ساعت دستگاه دقیق است',
    driftSlow: 'ساعت دستگاه {s} ثانیه عقب است',
    driftFast: 'ساعت دستگاه {s} ثانیه جلو است',
    driftSlowMin: 'ساعت دستگاه {m} دقیقه عقب است',
    driftFastMin: 'ساعت دستگاه {m} دقیقه جلو است',
    viewPersian: 'ماه شمسی',
    viewGregorian: 'ماه میلادی',
    sourceIr: 'ایران',
    sourceNuremberg: 'نورنبرگ',
    sourceUser: 'شخصی',
    estimated: 'تخمینی',
    noHolidays: 'این ماه تعطیلی ندارد',
    goToThisMonth: 'امروز — رفتن به ماه جاری',
    calendarsLabel: 'تقویم‌ها',
    holidaysSection: 'تقویم‌ها و تعطیلات',
    viewsLabel: 'نمایش زیر ساعت',
    holidaySourcesLabel: 'تعطیلات',
    sourceIrLong: 'ایران (رسمی)',
    sourceNurembergLong: 'نورنبرگ (باواریا)',
    sourceUserLong: 'تعطیلات من',
    holidayName: 'نام',
    holidayYear: 'سال (اختیاری)',
    everyYear: 'هر سال',
    holidayAdd: 'افزودن',
    holidaySave: 'ذخیره',
    holidayCancel: 'انصراف',
    holidayEdit: 'ویرایش',
    holidayDelete: 'حذف',
    holidayInvalid: 'یک نام و تاریخی معتبر وارد کنید',
    holidayLimit: 'حداکثر {max} تعطیلی می‌توانید داشته باشید',
    noUserHolidays: 'هنوز چیزی نیست',
    holidaysTestOk: 'برقرار · داده رسمی {year} · به‌روزشده {date}',
    holidaysTestNone: 'داده رسمی برای {year} نیست — تخمین‌ها استفاده می‌شوند',
    watchSection: 'ساعت',
    watchFace: 'صفحه',
    faceFullBleed: 'تمام‌صفحه',
    faceClassic: 'کلاسیک',
    showMovement: 'نمایش موتور',
    showTime: 'نمایش ساعت',
    watchLabel: 'ساعت، {time}',
    partBarrel: 'بشکه · یک دور در ۸ ساعت',
    partCentre: 'چرخ مرکزی · یک دور در ساعت',
    partThird: 'چرخ سوم · ۸ دور در ساعت',
    partFourth: 'چرخ چهارم · یک دور در دقیقه',
    partEscape: 'چرخ گریز · ۱۶ دور در دقیقه',
    partPallet: 'لنگر · ۸ ضربه در ثانیه',
    partBalance: 'چرخ تعادل · ۴ هرتز',
    movementLabel: 'موتور ساعت',
  },
};

export const HOLIDAY_NAMES: Record<Lang, Record<HolidayKey, string>> = {
  en: {
    'ir.nowruz': 'Nowruz',
    'ir.republic': 'Islamic Republic Day',
    'ir.nature': 'Nature Day (Sizdah Bedar)',
    'ir.khomeini': 'Death of Ayatollah Khomeini',
    'ir.uprising': '15 Khordad Uprising',
    'ir.revolution': 'Revolution Day',
    'ir.oil': 'Oil Nationalisation Day',
    'ir.tasua': 'Tasua',
    'ir.ashura': 'Ashura',
    'ir.arbaeen': 'Arbaeen',
    'ir.prophet': 'Death of the Prophet, Martyrdom of Imam Hasan',
    'ir.reza': 'Martyrdom of Imam Reza',
    'ir.askari': 'Martyrdom of Imam Hasan al-Askari',
    'ir.mawlid': 'Birth of the Prophet and Imam Sadiq',
    'ir.fatima': 'Martyrdom of Fatimah',
    'ir.ali-birth': 'Birth of Imam Ali',
    'ir.mabath': 'Mab’ath',
    'ir.mahdi': 'Birth of Imam Mahdi',
    'ir.ali-martyrdom': 'Martyrdom of Imam Ali',
    'ir.fitr': 'Eid al-Fitr',
    'ir.sadiq': 'Martyrdom of Imam Sadiq',
    'ir.adha': 'Eid al-Adha',
    'ir.ghadir': 'Eid al-Ghadir',
    'by.new-year': 'New Year’s Day',
    'by.epiphany': 'Epiphany',
    'by.good-friday': 'Good Friday',
    'by.easter-monday': 'Easter Monday',
    'by.labour': 'Labour Day',
    'by.ascension': 'Ascension Day',
    'by.whit-monday': 'Whit Monday',
    'by.corpus-christi': 'Corpus Christi',
    'by.unity': 'German Unity Day',
    'by.all-saints': 'All Saints’ Day',
    'by.christmas': 'Christmas Day',
    'by.boxing': 'St Stephen’s Day',
  },
  fa: {
    'ir.nowruz': 'عید نوروز',
    'ir.republic': 'روز جمهوری اسلامی',
    'ir.nature': 'روز طبیعت',
    'ir.khomeini': 'رحلت امام خمینی',
    'ir.uprising': 'قیام ۱۵ خرداد',
    'ir.revolution': 'پیروزی انقلاب اسلامی',
    'ir.oil': 'ملی شدن صنعت نفت',
    'ir.tasua': 'تاسوعای حسینی',
    'ir.ashura': 'عاشورای حسینی',
    'ir.arbaeen': 'اربعین حسینی',
    'ir.prophet': 'رحلت رسول اکرم و شهادت امام حسن مجتبی',
    'ir.reza': 'شهادت امام رضا',
    'ir.askari': 'شهادت امام حسن عسکری',
    'ir.mawlid': 'میلاد رسول اکرم و امام جعفر صادق',
    'ir.fatima': 'شهادت حضرت فاطمه زهرا',
    'ir.ali-birth': 'ولادت امام علی',
    'ir.mabath': 'مبعث رسول اکرم',
    'ir.mahdi': 'ولادت حضرت قائم',
    'ir.ali-martyrdom': 'شهادت امام علی',
    'ir.fitr': 'عید سعید فطر',
    'ir.sadiq': 'شهادت امام جعفر صادق',
    'ir.adha': 'عید سعید قربان',
    'ir.ghadir': 'عید سعید غدیر خم',
    'by.new-year': 'سال نو میلادی',
    'by.epiphany': 'عید ظهور',
    'by.good-friday': 'جمعهٔ نیک',
    'by.easter-monday': 'دوشنبهٔ عید پاک',
    'by.labour': 'روز کارگر',
    'by.ascension': 'عروج مسیح',
    'by.whit-monday': 'دوشنبهٔ پنطیکاست',
    'by.corpus-christi': 'عید جسم مسیح',
    'by.unity': 'روز وحدت آلمان',
    'by.all-saints': 'روز همهٔ مقدسین',
    'by.christmas': 'کریسمس',
    'by.boxing': 'دومین روز کریسمس',
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
