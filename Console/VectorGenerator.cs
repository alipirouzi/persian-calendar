using System.Globalization;
using System.Text.Json;

namespace Vectors;

public sealed record Vector(int Py, int Pm, int Pd, int Gy, int Gm, int Gd);

public static class VectorGenerator
{
    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static IReadOnlyList<Vector> Generate(int fromPersianYear, int toPersianYear)
    {
        var calendar = new PersianCalendar();
        var vectors = new List<Vector>();
        for (var py = fromPersianYear; py <= toPersianYear; py++)
        {
            for (var pm = 1; pm <= 12; pm++)
            {
                var days = calendar.GetDaysInMonth(py, pm);
                for (var pd = 1; pd <= days; pd++)
                {
                    var g = calendar.ToDateTime(py, pm, pd, 0, 0, 0, 0);
                    vectors.Add(new Vector(py, pm, pd, g.Year, g.Month, g.Day));
                }
            }
        }
        return vectors;
    }

    public static void WriteJson(string path, int fromPersianYear, int toPersianYear)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        File.WriteAllText(path, JsonSerializer.Serialize(Generate(fromPersianYear, toPersianYear), JsonOptions));
    }
}
