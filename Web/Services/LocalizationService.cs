namespace Web.Services;

public class LocalizationService
{
    private string currentLanguage = "en";
    private readonly Dictionary<string, Dictionary<string, string>> translations;

    public event Action? OnLanguageChanged;

    public string CurrentLanguage => currentLanguage;
    public bool IsRightToLeft => currentLanguage == "fa";
    public string Direction => IsRightToLeft ? "rtl" : "ltr";

    public LocalizationService()
    {
        translations = new Dictionary<string, Dictionary<string, string>>
        {
            ["en"] = new Dictionary<string, string>
            {
                ["PageTitle"] = "Persian Calendar Converter",
                ["MainTitle"] = "Persian Calendar Converter",
                ["CurrentDateTime"] = "Current Date & Time",
                ["PersianCalendar"] = "Persian (Shamsi)",
                ["GregorianCalendar"] = "Gregorian",
                ["Timezone"] = "Timezone",
                ["PersianToGregorian"] = "Persian to Gregorian",
                ["GregorianToPersian"] = "Gregorian to Persian",
                ["Year"] = "Year",
                ["Month"] = "Month",
                ["Day"] = "Day",
                ["Hour"] = "Hour",
                ["Minute"] = "Minute",
                ["Second"] = "Second",
                ["Convert"] = "Convert",
                ["Result"] = "Result:",
                ["ErrorYearRange"] = "Year must be between {0} and {1}",
                ["ErrorMonthRange"] = "Month must be between 1 and 12",
                ["ErrorDayRange"] = "Day must be between 1 and 31",
                ["ErrorInvalidDate"] = "Invalid date. Please check the day is valid for the given month.",
                ["ErrorGeneral"] = "Error: {0}",
                ["English"] = "English",
                ["Farsi"] = "فارسی",
                ["Farvardin"] = "Farvardin",
                ["Ordibehesht"] = "Ordibehesht",
                ["Khordad"] = "Khordad",
                ["Tir"] = "Tir",
                ["Mordad"] = "Mordad",
                ["Shahrivar"] = "Shahrivar",
                ["Mehr"] = "Mehr",
                ["Aban"] = "Aban",
                ["Azar"] = "Azar",
                ["Dey"] = "Dey",
                ["Bahman"] = "Bahman",
                ["Esfand"] = "Esfand",
                ["January"] = "January",
                ["February"] = "February",
                ["March"] = "March",
                ["April"] = "April",
                ["May"] = "May",
                ["June"] = "June",
                ["July"] = "July",
                ["August"] = "August",
                ["September"] = "September",
                ["October"] = "October",
                ["November"] = "November",
                ["December"] = "December"
            },
            ["fa"] = new Dictionary<string, string>
            {
                ["PageTitle"] = "تبدیل تقویم فارسی",
                ["MainTitle"] = "تبدیل تقویم فارسی",
                ["CurrentDateTime"] = "تاریخ و زمان فعلی",
                ["PersianCalendar"] = "شمسی",
                ["GregorianCalendar"] = "میلادی",
                ["Timezone"] = "منطقه زمانی",
                ["PersianToGregorian"] = "شمسی به میلادی",
                ["GregorianToPersian"] = "میلادی به شمسی",
                ["Year"] = "سال",
                ["Month"] = "ماه",
                ["Day"] = "روز",
                ["Hour"] = "ساعت",
                ["Minute"] = "دقیقه",
                ["Second"] = "ثانیه",
                ["Convert"] = "تبدیل",
                ["Result"] = "نتیجه:",
                ["ErrorYearRange"] = "سال باید بین {0} و {1} باشد",
                ["ErrorMonthRange"] = "ماه باید بین ۱ و ۱۲ باشد",
                ["ErrorDayRange"] = "روز باید بین ۱ و ۳۱ باشد",
                ["ErrorInvalidDate"] = "تاریخ نامعتبر است. لطفاً بررسی کنید که روز برای ماه داده شده معتبر باشد.",
                ["ErrorGeneral"] = "خطا: {0}",
                ["English"] = "English",
                ["Farsi"] = "فارسی",
                ["Farvardin"] = "فروردین",
                ["Ordibehesht"] = "اردیبهشت",
                ["Khordad"] = "خرداد",
                ["Tir"] = "تیر",
                ["Mordad"] = "مرداد",
                ["Shahrivar"] = "شهریور",
                ["Mehr"] = "مهر",
                ["Aban"] = "آبان",
                ["Azar"] = "آذر",
                ["Dey"] = "دی",
                ["Bahman"] = "بهمن",
                ["Esfand"] = "اسفند",
                ["January"] = "ژانویه",
                ["February"] = "فوریه",
                ["March"] = "مارس",
                ["April"] = "آوریل",
                ["May"] = "می",
                ["June"] = "ژوئن",
                ["July"] = "ژوئیه",
                ["August"] = "اوت",
                ["September"] = "سپتامبر",
                ["October"] = "اکتبر",
                ["November"] = "نوامبر",
                ["December"] = "دسامبر"
            }
        };
    }

    public string Translate(string key)
    {
        if (translations.TryGetValue(currentLanguage, out var languageTranslations))
        {
            if (languageTranslations.TryGetValue(key, out var translation))
            {
                return translation;
            }
        }
        return key;
    }

    public string Translate(string key, params object[] args)
    {
        var template = Translate(key);
        try
        {
            return string.Format(template, args);
        }
        catch
        {
            return template;
        }
    }

    public void SetLanguage(string language)
    {
        if (language != currentLanguage && translations.ContainsKey(language))
        {
            currentLanguage = language;
            OnLanguageChanged?.Invoke();
        }
    }

    public void ToggleLanguage()
    {
        SetLanguage(currentLanguage == "en" ? "fa" : "en");
    }

    public string GetPersianMonthName(int month)
    {
        var monthNames = new[]
        {
            "Farvardin", "Ordibehesht", "Khordad",
            "Tir", "Mordad", "Shahrivar",
            "Mehr", "Aban", "Azar",
            "Dey", "Bahman", "Esfand"
        };

        if (month < 1 || month > 12)
        {
            return string.Empty;
        }

        return Translate(monthNames[month - 1]);
    }

    public string GetGregorianMonthName(int month)
    {
        var monthNames = new[]
        {
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        };

        if (month < 1 || month > 12)
        {
            return string.Empty;
        }

        return Translate(monthNames[month - 1]);
    }
}
