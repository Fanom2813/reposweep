using System;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using RepoSweep.Models;
using RepoSweep.ViewModels;

namespace RepoSweep;

public partial class MainWindow : Window
{
    private const double TitleBarHeight = 44;
    private readonly MainViewModel _vm;

    public MainWindow(MainViewModel vm)
    {
        DataContext = vm;
        _vm = vm;
        InitializeComponent();

        // Window-level drag handler. Tunnels so we receive the press before
        // any child has a chance to mark it handled. Fires only inside the
        // top TitleBarHeight band and only when the press isn't on a Button.
        AddHandler(PointerPressedEvent, OnWindowPointerPressed,
            RoutingStrategies.Tunnel, handledEventsToo: true);

        Opened   += OnWindowOpened;
        Closing  += OnWindowClosing;
    }

    private void OnWindowOpened(object? sender, EventArgs e)
    {
        var w = _vm.LoadWindowPlacement();
        if (w.Width  > 200) Width  = w.Width;
        if (w.Height > 200) Height = w.Height;
        if (w.X >= 0 && w.Y >= 0) Position = new PixelPoint(w.X, w.Y);
        if (w.IsMaximized) WindowState = WindowState.Maximized;
    }

    private void OnWindowClosing(object? sender, WindowClosingEventArgs e)
    {
        _vm.SaveWindowPlacement(new WindowPlacement
        {
            Width        = Width,
            Height       = Height,
            X            = Position.X,
            Y            = Position.Y,
            IsMaximized  = WindowState == WindowState.Maximized,
        });
    }

    private void OnWindowPointerPressed(object? sender, PointerPressedEventArgs e)
    {
        // Cheapest checks first so clicks in the app body (the common case)
        // bail without walking the visual tree.
        var p = e.GetCurrentPoint(this);
        if (p.Position.Y > TitleBarHeight) return;
        if (!p.Properties.IsLeftButtonPressed) return;
        if (e.Source is Control src && IsInteractive(src)) return;

        if (e.ClickCount == 2)
        {
            WindowState = WindowState == WindowState.Maximized
                ? WindowState.Normal
                : WindowState.Maximized;
            e.Handled = true;
            return;
        }

        try { BeginMoveDrag(e); }
        catch (InvalidOperationException) { /* ignore */ }
    }

    private static bool IsInteractive(Control c)
    {
        for (var v = (Control?)c; v is not null; v = v.Parent as Control)
        {
            if (v is Button) return true;
        }
        return false;
    }

    public MainWindow() : this(App.BuildMainViewModel())
    {
    }

    public async void OnCleanClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: Project project })
            await _vm.CleanProjectAsync(project, ConfirmAsync);
    }

    public void OnOpenClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: string path })
            _vm.OpenFolder(path);
    }

    public async void OnRemoveRootClick(object? sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is Button { Tag: WorkspaceRootViewModel root })
        {
            var ok = await ConfirmAsync("Remove workspace",
                $"Remove {root.Label} from workspaces?");
            if (ok) _vm.RemoveRoot(root);
        }
    }

    public async void OnSelectRootClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Control { Tag: WorkspaceRootViewModel root })
            await _vm.SelectRoot(root);
    }

    public void OnNavClick(object? sender, RoutedEventArgs e)
    {
        if (sender is Control { Tag: string page })
            _vm.Navigate(page);
    }

    private Task<bool> ConfirmAsync(string title, string message)
    {
        var dlg = new Views.ConfirmDialog(title, message);
        return dlg.ShowDialog<bool>(this);
    }
}
