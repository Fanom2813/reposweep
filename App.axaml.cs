using System;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using RepoSweep.Services;
using RepoSweep.ViewModels;

namespace RepoSweep;

public partial class App : Application
{
    public static Registry Registry { get; } = new();
    public static SettingsStore SettingsStore { get; } = new();
    public static Scanner Scanner { get; } = new(Registry);
    public static ThemeService Theme { get; } = new();
    public static UpdateService Updater { get; } = new();

    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        // Load built-in and user-defined project types
        Registry.LoadFromAssetUri("avares://RepoSweep/Assets/project-types.json");
        Registry.LoadFromFile(SettingsStore.UserTypesPath);

        // Theme is restored by MainViewModel's constructor (it owns the
        // Theme property and calls ApplyTheme on load). Don't duplicate it
        // here, or the apply runs twice on startup.

        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow(BuildMainViewModel());
        }

        // Background update probe ~30s after launch. No-op when running
        // un-installed (e.g. `dotnet run`), so harmless in dev.
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(30));
            await Updater.CheckAsync();
        });

        base.OnFrameworkInitializationCompleted();
    }

    public static MainViewModel BuildMainViewModel()
        => new(Registry, Scanner, SettingsStore);
}
