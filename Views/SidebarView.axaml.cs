using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Avalonia.VisualTree;

namespace RepoSweep.Views;

public partial class SidebarView : UserControl
{
    public SidebarView() => AvaloniaXamlLoader.Load(this);

    private MainWindow? GetWindow() => this.FindAncestorOfType<MainWindow>();

    public void OnSelectRootClick(object? sender, RoutedEventArgs e)
        => GetWindow()?.OnSelectRootClick(sender, e);

    public void OnRemoveRootClick(object? sender, RoutedEventArgs e)
        => GetWindow()?.OnRemoveRootClick(sender, e);

    public void OnNavClick(object? sender, RoutedEventArgs e)
        => GetWindow()?.OnNavClick(sender, e);
}
