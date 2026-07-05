FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY PersianCalendar.sln ./
COPY Lib/Lib.csproj Lib/
COPY Web/Web.csproj Web/
COPY Console/Console.csproj Console/
COPY Tests/Tests.csproj Tests/
RUN dotnet restore Web/Web.csproj

COPY . .
# Note: no --no-restore here. Publishing with the full source tree present lets the
# SDK's Static Web Assets step materialize framework assets (e.g. _framework/blazor.web.js).
# With --no-restore after a csproj-only restore, those assets are silently omitted.
RUN dotnet publish Web/Web.csproj --configuration Release --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Web.dll"]
