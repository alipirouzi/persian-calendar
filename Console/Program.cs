using Lib;

var currentDate = DateTime.Now;
var persianDate = CalendarConverter.Convert(currentDate);
Console.WriteLine($"Current Persian Date: {persianDate}");