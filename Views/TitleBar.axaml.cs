using System.Runtime.InteropServices;
using Avalonia.Controls;
using Avalonia.Interactivity;

namespace RepoSweep.Views;

public partial class TitleBar : UserControl
{
    public TitleBar()
    {
        InitializeComponent();

        // Native chrome (min/max/close, traffic lights) is provided by the OS
        // via ExtendClientAreaToDecorationsHint on the Window. We only own the
        // drag region and the theme toggle. Drag is wired at the Window level
        // (see MainWindow.axaml.cs).
        var isMac = RuntimeInformation.IsOSPlatform(OSPlatform.OSX);
        MacSpacer.IsVisible = isMac;
        WindowControls.IsVisible = false;
    }

    private void OnMinimizeClick(object? sender, RoutedEventArgs e)
    {
        if (VisualRoot is Window w) w.WindowState = WindowState.Minimized;
    }

    private void OnMaximizeClick(object? sender, RoutedEventArgs e)
    {
        if (VisualRoot is Window w)
        {
            w.WindowState = w.WindowState == WindowState.Maximized
                ? WindowState.Normal
                : WindowState.Maximized;
        }
    }

    private void OnCloseClick(object? sender, RoutedEventArgs e)
    {
        if (VisualRoot is Window w) w.Close();
    }

    private async void OnApplyUpdateClick(object? sender, RoutedEventArgs e)
    {
        if (DataContext is RepoSweep.ViewModels.MainViewModel vm)
            await vm.ApplyUpdateAsync();
    }

    private void OnThemeToggleClick(object? sender, RoutedEventArgs e)
    {
        // Route through the VM so the change is persisted via the existing
        // OnThemeChanged → ApplyTheme + Persist pipeline. Keeps a single
        // source of truth for the active theme.
        if (DataContext is RepoSweep.ViewModels.MainViewModel vm)
            vm.ToggleTheme();
        else
            App.Theme.Toggle();
    }
}
