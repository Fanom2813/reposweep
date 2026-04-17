using System.Collections.Generic;

namespace RepoSweep.Models;

public sealed class PersistedState
{
    public List<string> Roots { get; set; } = new();
    public List<string> RecentRoots { get; set; } = new();
    public string SelectedRoot { get; set; } = "";
    public AppSettings Settings { get; set; } = new();
    public List<HistoryEntry> History { get; set; } = new();
    public WindowPlacement Window { get; set; } = new();
}

public sealed class WindowPlacement
{
    public double Width { get; set; }
    public double Height { get; set; }
    public int X { get; set; } = -1;
    public int Y { get; set; } = -1;
    public bool IsMaximized { get; set; }
}
