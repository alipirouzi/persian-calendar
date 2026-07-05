using Web.Services;

namespace Tests;

public class LocalizationServiceTests
{
    [Test]
    public void Constructor_SetsDefaultLanguageToEnglish()
    {
        var service = new LocalizationService();

        Assert.That(service.CurrentLanguage, Is.EqualTo("en"));
    }

    [Test]
    public void Constructor_SetsDirectionToLTRForEnglish()
    {
        var service = new LocalizationService();

        Assert.Multiple(() =>
        {
            Assert.That(service.IsRightToLeft, Is.False);
            Assert.That(service.Direction, Is.EqualTo("ltr"));
        });
    }

    [Test]
    public void Translate_WithValidEnglishKey_ReturnsEnglishTranslation()
    {
        var service = new LocalizationService();

        var result = service.Translate("MainTitle");

        Assert.That(result, Is.EqualTo("Persian Calendar Converter"));
    }

    [Test]
    public void Translate_WithValidFarsiKey_ReturnsFarsiTranslation()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        var result = service.Translate("MainTitle");

        Assert.That(result, Is.EqualTo("تبدیل تقویم فارسی"));
    }

    [Test]
    public void Translate_WithInvalidKey_ReturnsKey()
    {
        var service = new LocalizationService();

        var result = service.Translate("NonExistentKey");

        Assert.That(result, Is.EqualTo("NonExistentKey"));
    }

    [Test]
    public void Translate_WithFormatArgs_ReturnsFormattedString()
    {
        var service = new LocalizationService();

        var result = service.Translate("ErrorYearRange", 1, 9999);

        Assert.That(result, Is.EqualTo("Year must be between 1 and 9999"));
    }

    [Test]
    public void Translate_WithFormatArgsInFarsi_ReturnsFormattedString()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        var result = service.Translate("ErrorYearRange", 1, 9999);

        Assert.That(result, Is.EqualTo("سال باید بین 1 و 9999 باشد"));
    }

    [Test]
    public void SetLanguage_ToFarsi_ChangesLanguageAndDirection()
    {
        var service = new LocalizationService();

        service.SetLanguage("fa");

        Assert.Multiple(() =>
        {
            Assert.That(service.CurrentLanguage, Is.EqualTo("fa"));
            Assert.That(service.IsRightToLeft, Is.True);
            Assert.That(service.Direction, Is.EqualTo("rtl"));
        });
    }

    [Test]
    public void SetLanguage_ToEnglish_ChangesLanguageAndDirection()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        service.SetLanguage("en");

        Assert.Multiple(() =>
        {
            Assert.That(service.CurrentLanguage, Is.EqualTo("en"));
            Assert.That(service.IsRightToLeft, Is.False);
            Assert.That(service.Direction, Is.EqualTo("ltr"));
        });
    }

    [Test]
    public void SetLanguage_WithInvalidLanguage_DoesNotChangeLanguage()
    {
        var service = new LocalizationService();

        service.SetLanguage("invalid");

        Assert.That(service.CurrentLanguage, Is.EqualTo("en"));
    }

    [Test]
    public void SetLanguage_ToSameLanguage_DoesNotTriggerEvent()
    {
        var service = new LocalizationService();
        var eventTriggered = false;
        service.OnLanguageChanged += () => eventTriggered = true;

        service.SetLanguage("en");

        Assert.That(eventTriggered, Is.False);
    }

    [Test]
    public void SetLanguage_ToDifferentLanguage_TriggersEvent()
    {
        var service = new LocalizationService();
        var eventTriggered = false;
        service.OnLanguageChanged += () => eventTriggered = true;

        service.SetLanguage("fa");

        Assert.That(eventTriggered, Is.True);
    }

    [Test]
    public void ToggleLanguage_FromEnglishToFarsi_ChangesLanguage()
    {
        var service = new LocalizationService();

        service.ToggleLanguage();

        Assert.That(service.CurrentLanguage, Is.EqualTo("fa"));
    }

    [Test]
    public void ToggleLanguage_FromFarsiToEnglish_ChangesLanguage()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        service.ToggleLanguage();

        Assert.That(service.CurrentLanguage, Is.EqualTo("en"));
    }

    [Test]
    public void ToggleLanguage_TriggersLanguageChangedEvent()
    {
        var service = new LocalizationService();
        var eventTriggered = false;
        service.OnLanguageChanged += () => eventTriggered = true;

        service.ToggleLanguage();

        Assert.That(eventTriggered, Is.True);
    }

    [Test]
    public void GetPersianMonthName_InEnglish_ReturnsEnglishName()
    {
        var service = new LocalizationService();

        var result = service.GetPersianMonthName(1);

        Assert.That(result, Is.EqualTo("Farvardin"));
    }

    [Test]
    public void GetPersianMonthName_InFarsi_ReturnsFarsiName()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        var result = service.GetPersianMonthName(1);

        Assert.That(result, Is.EqualTo("فروردین"));
    }

    [Test]
    public void GetPersianMonthName_AllMonthsInEnglish_ReturnsCorrectNames()
    {
        var service = new LocalizationService();
        var expectedNames = new[]
        {
            "Farvardin", "Ordibehesht", "Khordad",
            "Tir", "Mordad", "Shahrivar",
            "Mehr", "Aban", "Azar",
            "Dey", "Bahman", "Esfand"
        };

        for (int i = 1; i <= 12; i++)
        {
            var result = service.GetPersianMonthName(i);
            Assert.That(result, Is.EqualTo(expectedNames[i - 1]));
        }
    }

    [Test]
    public void GetPersianMonthName_AllMonthsInFarsi_ReturnsCorrectNames()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");
        var expectedNames = new[]
        {
            "فروردین", "اردیبهشت", "خرداد",
            "تیر", "مرداد", "شهریور",
            "مهر", "آبان", "آذر",
            "دی", "بهمن", "اسفند"
        };

        for (int i = 1; i <= 12; i++)
        {
            var result = service.GetPersianMonthName(i);
            Assert.That(result, Is.EqualTo(expectedNames[i - 1]));
        }
    }

    [Test]
    public void GetPersianMonthName_WithInvalidMonth_ReturnsEmptyString()
    {
        var service = new LocalizationService();

        Assert.Multiple(() =>
        {
            Assert.That(service.GetPersianMonthName(0), Is.Empty);
            Assert.That(service.GetPersianMonthName(13), Is.Empty);
            Assert.That(service.GetPersianMonthName(-1), Is.Empty);
        });
    }

    [Test]
    public void GetGregorianMonthName_InEnglish_ReturnsEnglishName()
    {
        var service = new LocalizationService();

        var result = service.GetGregorianMonthName(1);

        Assert.That(result, Is.EqualTo("January"));
    }

    [Test]
    public void GetGregorianMonthName_InFarsi_ReturnsFarsiName()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        var result = service.GetGregorianMonthName(1);

        Assert.That(result, Is.EqualTo("ژانویه"));
    }

    [Test]
    public void GetGregorianMonthName_AllMonthsInEnglish_ReturnsCorrectNames()
    {
        var service = new LocalizationService();
        var expectedNames = new[]
        {
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        };

        for (int i = 1; i <= 12; i++)
        {
            var result = service.GetGregorianMonthName(i);
            Assert.That(result, Is.EqualTo(expectedNames[i - 1]));
        }
    }

    [Test]
    public void GetGregorianMonthName_AllMonthsInFarsi_ReturnsCorrectNames()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");
        var expectedNames = new[]
        {
            "ژانویه", "فوریه", "مارس", "آوریل", "می", "ژوئن",
            "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"
        };

        for (int i = 1; i <= 12; i++)
        {
            var result = service.GetGregorianMonthName(i);
            Assert.That(result, Is.EqualTo(expectedNames[i - 1]));
        }
    }

    [Test]
    public void GetGregorianMonthName_WithInvalidMonth_ReturnsEmptyString()
    {
        var service = new LocalizationService();

        Assert.Multiple(() =>
        {
            Assert.That(service.GetGregorianMonthName(0), Is.Empty);
            Assert.That(service.GetGregorianMonthName(13), Is.Empty);
            Assert.That(service.GetGregorianMonthName(-1), Is.Empty);
        });
    }

    [Test]
    public void TranslateMultipleKeys_InEnglish_ReturnsCorrectTranslations()
    {
        var service = new LocalizationService();

        Assert.Multiple(() =>
        {
            Assert.That(service.Translate("PageTitle"), Is.EqualTo("Persian Calendar Converter"));
            Assert.That(service.Translate("CurrentDateTime"), Is.EqualTo("Current Date & Time"));
            Assert.That(service.Translate("PersianCalendar"), Is.EqualTo("Persian (Shamsi)"));
            Assert.That(service.Translate("GregorianCalendar"), Is.EqualTo("Gregorian"));
            Assert.That(service.Translate("Convert"), Is.EqualTo("Convert"));
            Assert.That(service.Translate("Result"), Is.EqualTo("Result:"));
        });
    }

    [Test]
    public void TranslateMultipleKeys_InFarsi_ReturnsCorrectTranslations()
    {
        var service = new LocalizationService();
        service.SetLanguage("fa");

        Assert.Multiple(() =>
        {
            Assert.That(service.Translate("PageTitle"), Is.EqualTo("تبدیل تقویم فارسی"));
            Assert.That(service.Translate("CurrentDateTime"), Is.EqualTo("تاریخ و زمان فعلی"));
            Assert.That(service.Translate("PersianCalendar"), Is.EqualTo("شمسی"));
            Assert.That(service.Translate("GregorianCalendar"), Is.EqualTo("میلادی"));
            Assert.That(service.Translate("Convert"), Is.EqualTo("تبدیل"));
            Assert.That(service.Translate("Result"), Is.EqualTo("نتیجه:"));
        });
    }
}
