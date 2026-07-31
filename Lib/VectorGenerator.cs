using System.Globalization;
using System.Text.Json;
using Lib;

namespace Vectors;

/// <summary>
/// A single Persian → Gregorian date pair, used as a cross-language test vector.
/// </summary>
public sealed record Vector(int Py, int Pm, int Pd, int Gy, int Gm, int Gd);

/// <summary>
/// Produces Persian → Gregorian test vectors through <see cref="CalendarConverter"/>, so the
/// TypeScript implementation is checked against the same conversion path the .NET application
/// uses rather than a parallel one.
/// </summary>
public static class VectorGenerator
{
    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    /// <summary>
    /// Used for month lengths only — the conversion itself goes through <see cref="CalendarConverter"/>.
    /// </summary>
    private static readonly PersianCalendar MonthLengths = new();

    /// <summary>
    /// Generates a vector for every day of every Persian year in the inclusive range.
    /// </summary>
    /// <param name="fromPersianYear">First Persian year to generate (inclusive).</param>
    /// <param name="toPersianYear">Last Persian year to generate (inclusive).</param>
    public static IReadOnlyList<Vector> Generate(int fromPersianYear, int toPersianYear)
    {
        var vectors = new List<Vector>();
        for (var py = fromPersianYear; py <= toPersianYear; py++)
        {
            for (var pm = 1; pm <= 12; pm++)
            {
                var daysInMonth = MonthLengths.GetDaysInMonth(py, pm);
                for (var pd = 1; pd <= daysInMonth; pd++)
                {
                    var g = CalendarConverter.Convert(new PersianDate(py, pm, pd, 0, 0, 0, 0));
                    vectors.Add(new Vector(py, pm, pd, g.Year, g.Month, g.Day));
                }
            }
        }
        return vectors;
    }

    /// <summary>
    /// Serializes <see cref="Generate"/> output to <paramref name="path"/> as camelCase JSON,
    /// creating the parent directory if it does not exist.
    /// </summary>
    public static void WriteJson(string path, int fromPersianYear, int toPersianYear)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        File.WriteAllText(path, JsonSerializer.Serialize(Generate(fromPersianYear, toPersianYear), JsonOptions));
    }
}
