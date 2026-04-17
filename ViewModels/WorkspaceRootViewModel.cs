using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;

namespace RepoSweep.ViewModels;

public partial class WorkspaceRootViewModel : ObservableObject
{
    public string Path { get; }
    public string Label { get; }

    [ObservableProperty]
    private bool _isSelected;

    public WorkspaceRootViewModel(string path, bool isSelected)
    {
        Path = path;
        Label = GetLabel(path);
        _isSelected = isSelected;
    }

    private static string GetLabel(string path)
    {
        if (string.IsNullOrEmpty(path)) return "";
        var name = System.IO.Path.GetFileName(path.TrimEnd(System.IO.Path.DirectorySeparatorChar, '/', '\\'));
        return string.IsNullOrEmpty(name) ? path : name;
    }
}
