using Avalonia;
using Avalonia.Media;
using System;
using Velopack;

namespace RepoSweep;

class Program
{
    // Initialization code. Don't use any Avalonia, third-party APIs or any
    // SynchronizationContext-reliant code before AppMain is called: things aren't initialized
    // yet and stuff might break.
    [STAThread]
    public static void Main(string[] args)
    {
        // MUST run before any other code so Velopack can intercept install/
        // update/uninstall hooks (e.g. --veloapp-install). Returns immediately
        // for normal launches.
        VelopackApp.Build().SetArgs(args).Run();

        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    // Avalonia configuration, don't remove; also used by visual designer.
    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
#if DEBUG
            .WithDeveloperTools()
#endif
            .With(new FontManagerOptions
            {
                DefaultFamilyName = "avares://RepoSweep/Assets/Fonts#Ubuntu",
            })
            .LogToTrace();
}
