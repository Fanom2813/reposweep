using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Avalonia.VisualTree;

namespace RepoSweep.Views;

public partial class WorkspaceView : UserControl
{
    public WorkspaceView() => AvaloniaXamlLoader.Load(this);

    private MainWindow? GetWindow() => this.FindAncestorOfType<MainWindow>();

    public void OnCleanClick(object? sender, RoutedEventArgs e)
        => GetWindow()?.OnCleanClick(sender, e);

    public void OnOpenClick(object? sender, RoutedEventArgs e)
        => GetWindow()?.OnOpenClick(sender, e);
}
