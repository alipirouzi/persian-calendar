using Lib;

namespace Tests;

public class CalendarConverterTests
{
    [Test]
    public void ConvertPersianToGregorian_ValidDate_ReturnsCorrectDateTime()
    {
        var persianDate = new PersianDate(1403, 10, 22);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2025));
            Assert.That(result.Month, Is.EqualTo(1));
            Assert.That(result.Day, Is.EqualTo(11));
        });
    }

    [Test]
    public void ConvertGregorianToPersian_ValidDate_ReturnsCorrectPersianDate()
    {
        var gregorianDate = new DateTime(2025, 1, 11);

        var result = CalendarConverter.Convert(gregorianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(1403));
            Assert.That(result.Month, Is.EqualTo(10));
            Assert.That(result.Day, Is.EqualTo(22));
        });
    }

    [Test]
    public void ConvertPersianToGregorian_WithTime_PreservesTimeComponents()
    {
        var persianDate = new PersianDate(1403, 10, 22, 14, 30, 45, 123);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Hour, Is.EqualTo(14));
            Assert.That(result.Minute, Is.EqualTo(30));
            Assert.That(result.Second, Is.EqualTo(45));
            Assert.That(result.Millisecond, Is.EqualTo(123));
        });
    }

    [Test]
    public void ConvertGregorianToPersian_WithTime_PreservesTimeComponents()
    {
        var gregorianDate = new DateTime(2025, 1, 11, 14, 30, 45, 123);

        var result = CalendarConverter.Convert(gregorianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Hour, Is.EqualTo(14));
            Assert.That(result.Minute, Is.EqualTo(30));
            Assert.That(result.Second, Is.EqualTo(45));
            Assert.That(result.Millisecond, Is.EqualTo(123));
        });
    }

    [Test]
    public void ConvertPersianToGregorian_Nowruz_ReturnsCorrectDate()
    {
        var persianDate = new PersianDate(1403, 1, 1);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2024));
            Assert.That(result.Month, Is.EqualTo(3));
            Assert.That(result.Day, Is.EqualTo(20));
        });
    }

    [Test]
    public void ConvertGregorianToPersian_Nowruz_ReturnsCorrectDate()
    {
        var gregorianDate = new DateTime(2024, 3, 20);

        var result = CalendarConverter.Convert(gregorianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(1403));
            Assert.That(result.Month, Is.EqualTo(1));
            Assert.That(result.Day, Is.EqualTo(1));
        });
    }

    [Test]
    public void ConvertPersianToGregorian_EndOfYear_ReturnsCorrectDate()
    {
        var persianDate = new PersianDate(1402, 12, 29);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2024));
            Assert.That(result.Month, Is.EqualTo(3));
            Assert.That(result.Day, Is.EqualTo(19));
        });
    }

    [Test]
    public void ConvertGregorianToPersian_LeapYear_ReturnsCorrectDate()
    {
        var gregorianDate = new DateTime(2024, 2, 29);

        var result = CalendarConverter.Convert(gregorianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(1402));
            Assert.That(result.Month, Is.EqualTo(12));
            Assert.That(result.Day, Is.EqualTo(10));
        });
    }

    [Test]
    public void RoundTripConversion_PersianToGregorianAndBack_PreservesDate()
    {
        var originalPersianDate = new PersianDate(1403, 5, 15, 10, 20, 30, 500);

        var gregorianDate = CalendarConverter.Convert(originalPersianDate);
        var convertedBackPersianDate = CalendarConverter.Convert(gregorianDate);

        Assert.Multiple(() =>
        {
            Assert.That(convertedBackPersianDate.Year, Is.EqualTo(originalPersianDate.Year));
            Assert.That(convertedBackPersianDate.Month, Is.EqualTo(originalPersianDate.Month));
            Assert.That(convertedBackPersianDate.Day, Is.EqualTo(originalPersianDate.Day));
            Assert.That(convertedBackPersianDate.Hour, Is.EqualTo(originalPersianDate.Hour));
            Assert.That(convertedBackPersianDate.Minute, Is.EqualTo(originalPersianDate.Minute));
            Assert.That(convertedBackPersianDate.Second, Is.EqualTo(originalPersianDate.Second));
            Assert.That(convertedBackPersianDate.Millisecond, Is.EqualTo(originalPersianDate.Millisecond));
        });
    }

    [Test]
    public void RoundTripConversion_GregorianToPersianAndBack_PreservesDate()
    {
        var originalGregorianDate = new DateTime(2025, 6, 15, 10, 20, 30, 500);

        var persianDate = CalendarConverter.Convert(originalGregorianDate);
        var convertedBackGregorianDate = CalendarConverter.Convert(persianDate);

        Assert.That(convertedBackGregorianDate, Is.EqualTo(originalGregorianDate));
    }

    [Test]
    public void ConvertPersianToGregorian_FirstDayOfMonth_ReturnsCorrectDate()
    {
        var persianDate = new PersianDate(1403, 7, 1);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2024));
            Assert.That(result.Month, Is.EqualTo(9));
            Assert.That(result.Day, Is.EqualTo(22));
        });
    }

    [Test]
    public void ConvertPersianToGregorian_LastDayOfSixMonthPeriod_ReturnsCorrectDate()
    {
        var persianDate = new PersianDate(1403, 6, 31);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2024));
            Assert.That(result.Month, Is.EqualTo(9));
            Assert.That(result.Day, Is.EqualTo(21));
        });
    }

    [Test]
    public void ConvertPersianToGregorian_HistoricalDate_ReturnsCorrectDate()
    {
        var persianDate = new PersianDate(1358, 10, 16);

        var result = CalendarConverter.Convert(persianDate);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(1980));
            Assert.That(result.Month, Is.EqualTo(1));
            Assert.That(result.Day, Is.EqualTo(6));
        });
    }

    [Test]
    public void ConvertUtcToTimeZone_TehranTimeZone_ReturnsCorrectTime()
    {
        var utcTime = new DateTime(2025, 1, 11, 12, 0, 0, DateTimeKind.Utc);
        var tehranTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");

        var result = TimeZoneInfo.ConvertTimeFromUtc(utcTime, tehranTimeZone);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2025));
            Assert.That(result.Month, Is.EqualTo(1));
            Assert.That(result.Day, Is.EqualTo(11));
            Assert.That(result.Hour, Is.EqualTo(15) | Is.EqualTo(16));
        });
    }

    [Test]
    public void ConvertUtcToTimeZone_BerlinTimeZone_ReturnsCorrectTime()
    {
        var utcTime = new DateTime(2025, 1, 11, 12, 0, 0, DateTimeKind.Utc);
        var berlinTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Berlin");

        var result = TimeZoneInfo.ConvertTimeFromUtc(utcTime, berlinTimeZone);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2025));
            Assert.That(result.Month, Is.EqualTo(1));
            Assert.That(result.Day, Is.EqualTo(11));
            Assert.That(result.Hour, Is.EqualTo(13));
        });
    }

    [Test]
    public void ConvertUtcToTimeZone_NewYorkTimeZone_ReturnsCorrectTime()
    {
        var utcTime = new DateTime(2025, 1, 11, 12, 0, 0, DateTimeKind.Utc);
        var newYorkTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");

        var result = TimeZoneInfo.ConvertTimeFromUtc(utcTime, newYorkTimeZone);

        Assert.Multiple(() =>
        {
            Assert.That(result.Year, Is.EqualTo(2025));
            Assert.That(result.Month, Is.EqualTo(1));
            Assert.That(result.Day, Is.EqualTo(11));
            Assert.That(result.Hour, Is.EqualTo(7));
        });
    }

    [Test]
    public void TimeZoneConversion_RoundTrip_PreservesUtcTime()
    {
        var originalUtcTime = new DateTime(2025, 1, 11, 12, 30, 45, DateTimeKind.Utc);
        var tehranTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");

        var tehranTime = TimeZoneInfo.ConvertTimeFromUtc(originalUtcTime, tehranTimeZone);
        var convertedBackUtc = TimeZoneInfo.ConvertTimeToUtc(tehranTime, tehranTimeZone);

        Assert.That(convertedBackUtc, Is.EqualTo(originalUtcTime));
    }
}
