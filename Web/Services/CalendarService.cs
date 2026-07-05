using Lib;

namespace Web.Services;

public class CalendarService : IDisposable
{
    private Timer? timer;
    private DateTime currentDateTime;
    private string persianTimeZoneId = "Asia/Tehran";
    private string gregorianTimeZoneId = "Europe/Berlin";

    public event Action? OnTimeChanged;
    public event Action? OnTimeZoneChanged;

    public DateTime CurrentDateTime => currentDateTime;
    public PersianDate CurrentPersianDate => CalendarConverter.Convert(currentDateTime);

    public string PersianTimeZoneId
    {
        get => persianTimeZoneId;
        set
        {
            if (persianTimeZoneId != value)
            {
                persianTimeZoneId = value;
                OnTimeZoneChanged?.Invoke();
            }
        }
    }

    public string GregorianTimeZoneId
    {
        get => gregorianTimeZoneId;
        set
        {
            if (gregorianTimeZoneId != value)
            {
                gregorianTimeZoneId = value;
                OnTimeZoneChanged?.Invoke();
            }
        }
    }

    public DateTime CurrentPersianTimeZoneDateTime
    {
        get
        {
            var utcNow = DateTime.UtcNow;
            var timeZone = TimeZoneInfo.FindSystemTimeZoneById(persianTimeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone);
        }
    }

    public DateTime CurrentGregorianTimeZoneDateTime
    {
        get
        {
            var utcNow = DateTime.UtcNow;
            var timeZone = TimeZoneInfo.FindSystemTimeZoneById(gregorianTimeZoneId);
            return TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone);
        }
    }

    public PersianDate CurrentPersianTimeZonePersianDate => CalendarConverter.Convert(CurrentPersianTimeZoneDateTime);

    public List<string> GetAvailableTimeZones()
    {
        return
        [
            "UTC",
            "Asia/Tehran",
            "Europe/Berlin",
            "Europe/London",
            "Europe/Paris",
            "America/New_York",
            "America/Los_Angeles",
            "America/Chicago",
            "America/Toronto",
            "Asia/Dubai",
            "Asia/Tokyo",
            "Asia/Shanghai",
            "Asia/Singapore",
            "Australia/Sydney",
            "Pacific/Auckland"
        ];
    }

    public string GetTimeZoneDisplayName(string timeZoneId)
    {
        try
        {
            var timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            var offset = timeZone.GetUtcOffset(DateTime.UtcNow);
            var offsetString = offset.TotalHours >= 0 ? $"+{offset.TotalHours:0.#}" : $"{offset.TotalHours:0.#}";
            return $"{timeZoneId} (UTC{offsetString})";
        }
        catch
        {
            return timeZoneId;
        }
    }

    public CalendarService()
    {
        currentDateTime = DateTime.UtcNow;
        timer = new Timer(UpdateTime, null, TimeSpan.Zero, TimeSpan.FromSeconds(1));
    }

    private void UpdateTime(object? state)
    {
        currentDateTime = DateTime.UtcNow;
        OnTimeChanged?.Invoke();
    }

    public PersianDate ConvertToPersian(DateTime gregorianDate)
    {
        return CalendarConverter.Convert(gregorianDate);
    }

    public DateTime ConvertToGregorian(PersianDate persianDate)
    {
        return CalendarConverter.Convert(persianDate);
    }

    public void Dispose()
    {
        timer?.Dispose();
    }
}
