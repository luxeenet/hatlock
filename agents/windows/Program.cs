// HatLock Windows Agent — Program Entry Point
// Runs as a Windows Service (systemd equivalent on Windows)
// Handles: device enrollment, heartbeat, authorization check, and restriction enforcement

using HatLock.Agent;
using HatLock.Agent.Services;
using Microsoft.Extensions.Hosting.WindowsServices;

var builder = Host.CreateApplicationBuilder(args);

// Configure as Windows Service for production; console for development
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "HatLock Device Protection Agent";
});

// Configuration
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables("HATLOCK_");

// HTTP client for API communication
builder.Services.AddHttpClient<ApiClient>(client =>
{
    var apiUrl = builder.Configuration["Api:BaseUrl"] ?? "https://api.hatlock.luxeenet.com";
    client.BaseAddress = new Uri(apiUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.Add("User-Agent", $"HatLock-Windows-Agent/1.0.0");
});

// Core services
builder.Services.AddSingleton<CredentialStore>();
builder.Services.AddSingleton<HardwareIdentityCollector>();
builder.Services.AddSingleton<CommandProcessor>();
builder.Services.AddSingleton<RestrictionEngine>();

// Background worker
builder.Services.AddHostedService<AgentWorker>();

// Logging
builder.Logging.AddEventLog(settings =>
{
    settings.SourceName = "HatLock Agent";
});

var host = builder.Build();
await host.RunAsync();
