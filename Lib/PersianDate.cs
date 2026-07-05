namespace Lib;

/// <summary>
/// Represents a date and time expressed in the Persian (Shamsi/Solar Hijri) calendar.
/// </summary>
/// <param name="Year">The Persian calendar year.</param>
/// <param name="Month">The Persian calendar month (1-12).</param>
/// <param name="Day">The day of the month (1-31, depending on the month).</param>
/// <param name="Hour">The hour of the day (0-23). Defaults to 0.</param>
/// <param name="Minute">The minute of the hour (0-59). Defaults to 0.</param>
/// <param name="Second">The second of the minute (0-59). Defaults to 0.</param>
/// <param name="Millisecond">The millisecond of the second (0-999). Defaults to 0.</param>
public record struct PersianDate(
    int Year,
    int Month,
    int Day,
    int Hour = 0,
    int Minute = 0,
    int Second = 0,
    int Millisecond = 0);
