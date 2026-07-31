using Lib;
using Vectors;

if (args is ["--generate-vectors", var path, var from, var to])
{
    VectorGenerator.WriteJson(path, int.Parse(from), int.Parse(to));
    Console.WriteLine($"Wrote vectors {from}-{to} to {path}");
    return;
}

var currentDate = DateTime.Now;
var persianDate = CalendarConverter.Convert(currentDate);
Console.WriteLine($"Current Persian Date: {persianDate}");
