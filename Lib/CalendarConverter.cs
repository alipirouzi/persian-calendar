using System.Globalization;

namespace Lib;

/// <summary>
/// Converts dates between the Persian (Shamsi/Solar Hijri) calendar and the
/// Gregorian calendar, preserving time-of-day components across conversions.
/// </summary>
public static class CalendarConverter
{
    private static readonly PersianCalendar PersianCalendarInstance = new();

    /// <summary>
    /// Converts a <see cref="PersianDate"/> to its equivalent Gregorian <see cref="DateTime"/>.
    /// </summary>
    /// <param name="date">The Persian date to convert.</param>
    /// <returns>The equivalent Gregorian date and time.</returns>
    /// <exception cref="ArgumentOutOfRangeException">
    /// Thrown when <paramref name="date"/> does not represent a valid date in the Persian
    /// calendar (for example, an out-of-range year/month, or a day that does not exist in
    /// the given month).
    /// </exception>
    public static DateTime Convert(PersianDate date)
    {
        return PersianCalendarInstance.ToDateTime(date.Year, date.Month, date.Day, date.Hour, date.Minute,
            date.Second, date.Millisecond);
    }

    /// <summary>
    /// Converts a Gregorian <see cref="DateTime"/> to its equivalent <see cref="PersianDate"/>.
    /// </summary>
    /// <param name="date">The Gregorian date and time to convert.</param>
    /// <returns>The equivalent Persian date, with time components preserved.</returns>
    /// <remarks>Always succeeds for any valid <see cref="DateTime"/> value.</remarks>
    public static PersianDate Convert(DateTime date)
    {
        var year = PersianCalendarInstance.GetYear(date);
        var month = PersianCalendarInstance.GetMonth(date);
        var day = PersianCalendarInstance.GetDayOfMonth(date);
        return new PersianDate(year, month, day, date.Hour, date.Minute, date.Second, date.Millisecond);
    }
}
