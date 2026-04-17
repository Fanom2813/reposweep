using Avalonia;
using Avalonia.Styling;

namespace RepoSweep.Services;

public sealed class ThemeService
{
    public const string System = "system";
    public const string Light  = "light";
    public const string Dark   = "dark";

    public string Current { get; private set; } = System;

    public void Apply(string? theme)
    {
        var t = (theme ?? System).ToLowerInvariant();
        Current = t;

        if (Application.Current is null) return;

        Application.Current.RequestedThemeVariant = t switch
        {
            Light => ThemeVariant.Light,
            Dark  => ThemeVariant.Dark,
            _     => ThemeVariant.Default,
        };
    }

    public void Toggle()
    {
        var next = Current switch
        {
            Light => Dark,
            Dark  => System,
            _     => Light,
        };
        Apply(next);
    }
}
