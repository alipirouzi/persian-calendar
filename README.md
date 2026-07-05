# Persian Calendar Converter

A comprehensive Persian (Shamsi/Solar Hijri) to Gregorian calendar converter built with .NET 10 and Blazor. The application provides real-time calendar conversion, multi-timezone support, and bilingual interface in English and Farsi.

## Overview

This project enables seamless conversion between Persian and Gregorian calendars with precise timezone handling. It includes a web interface for interactive conversions, a console application for quick conversions, and a robust library for integration into other projects.

## Features

- Real-time bidirectional calendar conversion between Persian and Gregorian calendars
- Live clock display with automatic updates
- Multi-timezone support with 15+ predefined timezones
- Bilingual interface with full RTL support for Farsi
- Date validation with comprehensive error handling
- Round-trip conversion accuracy preservation
- Responsive web interface built with Blazor Server
- Comprehensive test coverage with NUnit

## Technologies

- .NET 10.0
- ASP.NET Core Blazor Server
- C# with nullable reference types enabled
- NUnit for testing
- System.Globalization.PersianCalendar for calendar calculations

## Project Structure

```
PersianCalendar/
├── Lib/                          # Core library
│   ├── PersianDate.cs           # Persian date record structure
│   └── CalendarConverter.cs     # Conversion logic
├── Console/                      # Console application
│   └── Program.cs               # Command-line interface
├── Web/                          # Web application
│   ├── Program.cs               # Application entry point
│   ├── Components/
│   │   ├── Pages/
│   │   │   ├── Home.razor       # Main calendar interface
│   │   │   ├── Error.razor      # Error page
│   │   │   └── NotFound.razor   # 404 page
│   │   ├── Layout/
│   │   │   ├── MainLayout.razor       # Main layout wrapper
│   │   │   ├── NavMenu.razor          # Navigation menu
│   │   │   ├── LanguageToggle.razor   # Language switcher
│   │   │   └── ReconnectModal.razor   # Reconnection UI
│   │   └── App.razor            # Root component
│   ├── Services/
│   │   ├── CalendarService.cs         # Calendar operations
│   │   └── LocalizationService.cs     # Translation service
│   └── wwwroot/
│       ├── app.css              # Styling
│       └── favicon.png          # Application icon
└── Tests/                        # Test suite
    ├── CalendarConverterTests.cs      # Converter tests
    └── LocalizationServiceTests.cs    # Localization tests
```

## Prerequisites

- .NET 10.0 SDK or later
- Operating system with timezone data support (Windows, macOS, Linux)

### Verify Prerequisites

Check if .NET 10 SDK is installed:

```bash
dotnet --version
```

Expected output: `10.0.100` or higher

If not installed, download from [Microsoft .NET Downloads](https://dotnet.microsoft.com/download/dotnet/10.0).

## Installation

### Clone or Download the Project

Navigate to the project directory:

```bash
cd /Users/ali/Projects/PersianCalendar
```

### Restore Dependencies

Restore NuGet packages for all projects:

```bash
dotnet restore
```

### Build the Solution

Build all projects:

```bash
dotnet build
```

This will compile:
- `Lib.csproj` - Core library
- `Console.csproj` - Console application
- `Web.csproj` - Web application
- `Tests.csproj` - Test suite

## Running the Application

### Web Application

Start the Blazor web application:

```bash
cd Web
dotnet run
```

The application will start and display URLs in the console:

```
Now listening on: https://localhost:7257
Now listening on: http://localhost:5189
```

Open your browser and navigate to:
- HTTPS: `https://localhost:7257`
- HTTP: `http://localhost:5189`

To stop the application, press `Ctrl+C` in the terminal.

### Console Application

Run the console application for quick date conversion:

```bash
cd Console
dotnet run
```

This will display the current Persian date converted from the system time.

## Debugging the Application

### Visual Studio / JetBrains Rider

1. Open `PersianCalendar.sln` in your IDE
2. Set `Web` as the startup project
3. Press F5 to start debugging
4. Breakpoints can be set in any `.cs` or `.razor` file

### Visual Studio Code

1. Open the project folder in VS Code
2. Install the C# Dev Kit extension
3. Open the Debug panel (Ctrl+Shift+D)
4. Select ".NET Core Launch (web)" configuration
5. Press F5 to start debugging

### Command Line Debugging

Run the application in debug mode:

```bash
cd Web
dotnet run --configuration Debug
```

Attach a debugger using your IDE's attach to process feature, targeting the `dotnet` process.

### Launch Profiles

The web application includes two launch profiles defined in `Web/Properties/launchSettings.json`:

- `http`: Runs on `http://localhost:5189`
- `https`: Runs on `https://localhost:7257` with HTTP redirect

## Running Tests

### Run All Tests

Execute the complete test suite:

```bash
cd Tests
dotnet test
```

### Run Tests with Detailed Output

```bash
dotnet test --verbosity normal
```

### Run Tests with Coverage

```bash
dotnet test --collect:"XPlat Code Coverage"
```

### Test Organization

The test suite includes:

- **CalendarConverterTests.cs**: 20+ tests covering:
  - Persian to Gregorian conversion
  - Gregorian to Persian conversion
  - Time component preservation
  - Round-trip conversion accuracy
  - Historical date validation
  - Timezone conversion
  - Leap year handling
  - Special dates (Nowruz, year boundaries)

- **LocalizationServiceTests.cs**: 30+ tests covering:
  - Language switching (English/Farsi)
  - Translation functionality
  - RTL/LTR direction handling
  - Month name localization
  - Format string handling
  - Event triggering

## Configuration

### Default Timezones

The application uses these default timezones:
- Persian Calendar: `Asia/Tehran`
- Gregorian Calendar: `Europe/Berlin`

### Supported Timezones

- UTC
- Asia/Tehran
- Europe/Berlin
- Europe/London
- Europe/Paris
- America/New_York
- America/Los_Angeles
- America/Chicago
- America/Toronto
- Asia/Dubai
- Asia/Tokyo
- Asia/Shanghai
- Asia/Singapore
- Australia/Sydney
- Pacific/Auckland

### Customizing Timezones

To add or modify available timezones, edit the `GetAvailableTimeZones()` method in:

```
Web/Services/CalendarService.cs
```

## Using the Web Interface

### Real-Time Clock Display

The home page displays:
- Current Persian date and time in selected timezone
- Current Gregorian date and time in selected timezone
- Live updates every second
- Timezone selector for both calendars

### Persian to Gregorian Conversion

1. Enter the Persian date components:
   - Year (1-9999)
   - Month (1-12)
   - Day (1-31)
2. Click "Convert" or "تبدیل"
3. View the converted Gregorian date

### Gregorian to Persian Conversion

1. Enter the Gregorian date components:
   - Year (622-9999)
   - Month (1-12)
   - Day (1-31)
2. Click "Convert" or "تبدیل"
3. View the converted Persian date

### Language Toggle

Click the language toggle button in the navigation bar to switch between English and Farsi. The interface will automatically adjust direction (LTR/RTL) and translations.

## Using the Library

### Reference the Library

Add a project reference to `Lib.csproj`:

```xml
<ItemGroup>
  <ProjectReference Include="../Lib/Lib.csproj" />
</ItemGroup>
```

### Basic Usage

```csharp
using Lib;

// Convert Gregorian to Persian
var gregorianDate = new DateTime(2025, 1, 11);
var persianDate = CalendarConverter.Convert(gregorianDate);
// Result: Year=1403, Month=10, Day=22

// Convert Persian to Gregorian
var persianDate = new PersianDate(1403, 10, 22);
var gregorianDate = CalendarConverter.Convert(persianDate);
// Result: 2025-01-11

// Include time components
var persianDateTime = new PersianDate(1403, 10, 22, 14, 30, 45, 123);
var gregorianDateTime = CalendarConverter.Convert(persianDateTime);
// Time components are preserved
```

### PersianDate Structure

```csharp
public record struct PersianDate(
    int Year,
    int Month,
    int Day,
    int Hour = 0,
    int Minute = 0,
    int Second = 0,
    int Millisecond = 0
);
```

## API Reference

### CalendarConverter

Static class providing conversion methods:

**Convert(PersianDate date) -> DateTime**
- Converts a Persian date to Gregorian DateTime
- Preserves time components
- Throws `ArgumentOutOfRangeException` for invalid dates

**Convert(DateTime date) -> PersianDate**
- Converts a Gregorian DateTime to Persian date
- Preserves time components
- Always succeeds for valid DateTime values

### CalendarService

Service for web application with real-time updates:

**Properties**
- `CurrentDateTime`: System DateTime
- `CurrentPersianDate`: Current date as Persian
- `CurrentPersianTimeZoneDateTime`: Current time in Persian timezone
- `CurrentGregorianTimeZoneDateTime`: Current time in Gregorian timezone
- `PersianTimeZoneId`: Persian timezone identifier
- `GregorianTimeZoneId`: Gregorian timezone identifier

**Methods**
- `ConvertToPersian(DateTime)`: Convert to Persian
- `ConvertToGregorian(PersianDate)`: Convert to Gregorian
- `GetAvailableTimeZones()`: List supported timezones
- `GetTimeZoneDisplayName(string)`: Format timezone display name

**Events**
- `OnTimeChanged`: Fires every second
- `OnTimeZoneChanged`: Fires when timezone changes

### LocalizationService

Service for managing translations and localization:

**Properties**
- `CurrentLanguage`: Current language code ("en" or "fa")
- `IsRightToLeft`: Boolean indicating RTL mode
- `Direction`: "rtl" or "ltr"

**Methods**
- `Translate(string key)`: Get translation for key
- `Translate(string key, params object[] args)`: Get formatted translation
- `SetLanguage(string language)`: Change language
- `ToggleLanguage()`: Switch between English and Farsi
- `GetPersianMonthName(int month)`: Get Persian month name
- `GetGregorianMonthName(int month)`: Get Gregorian month name

**Events**
- `OnLanguageChanged`: Fires when language changes

## Troubleshooting

### Port Already in Use

If port 5189 or 7257 is already in use:

1. Stop any running instances of the application
2. Or modify ports in `Web/Properties/launchSettings.json`

### Timezone Not Found

If you encounter timezone errors:

1. Ensure your operating system has up-to-date timezone data
2. Verify the timezone ID format matches your OS:
   - Windows: Use IANA timezone IDs
   - macOS/Linux: Use IANA timezone IDs

### Build Errors

If you encounter build errors:

1. Ensure .NET 10 SDK is installed: `dotnet --version`
2. Clean the solution: `dotnet clean`
3. Restore packages: `dotnet restore`
4. Rebuild: `dotnet build`

### Test Failures

If timezone tests fail:

1. Check that your system timezone data is current
2. Some tests allow for hour variance due to DST
3. Run tests individually to isolate issues:
   ```bash
   dotnet test --filter "FullyQualifiedName~CalendarConverterTests.ConvertPersianToGregorian_ValidDate_ReturnsCorrectDateTime"
   ```

## Development

### Building for Release

```bash
dotnet build --configuration Release
```

### Publishing the Web Application

```bash
cd Web
dotnet publish --configuration Release --output ./publish
```

The published files will be in `Web/publish/` directory.

### Code Quality

The project enforces:
- Nullable reference types
- Implicit usings
- Latest C# language version
- No compiler warnings

## Deployment (Docker + Coolify CI/CD)

The application deploys as a container built from the repository's `Dockerfile`:

1. A change is merged into `master`.
2. GitHub Actions (`.github/workflows/ci.yml`) runs the `test` job: restore, build with
   `-warnaserror`, and run the full test suite.
3. If tests pass, the `deploy` job fires a GET request against the Coolify deploy webhook
   (`COOLIFY_WEBHOOK_URL`, authenticated with `COOLIFY_API_TOKEN`, both stored as GitHub
   Actions secrets — never committed to the repository).
4. Coolify builds the multi-stage `Dockerfile` (SDK build stage, ASP.NET runtime stage) and
   runs the resulting container on the private server network.
5. A Caddy reverse-proxy gateway terminates TLS and forwards plain HTTP to the container,
   serving the app at **https://time.automated.ink**. Blazor Server's SignalR circuit runs
   over a WebSocket that passes through this proxy.

The container listens on port `8080` (`ASPNETCORE_HTTP_PORTS=8080`), runs as the non-root
`app` user from the base image, and exposes `/health` for container health checks — reachable
without authentication, matching the `HEALTHCHECK` instruction in the `Dockerfile`.

Because the app sits behind a TLS-terminating proxy, `Program.cs` configures
`ForwardedHeadersOptions` (`XForwardedFor` and `XForwardedProto`) so `UseHttpsRedirection`
and HSTS see the original scheme instead of the proxy's plain-HTTP connection.

### Building the Docker Image Locally

```bash
docker build -t persian-calendar .
docker run -p 8080:8080 persian-calendar
```

## License

MIT — © 2026 Ali Pirouzi

## Contributing

When contributing:
1. Follow existing code style and conventions
2. Ensure all tests pass
3. Add tests for new functionality
4. Update documentation as needed

## Support

For issues, questions, or contributions, refer to the project repository or documentation.
