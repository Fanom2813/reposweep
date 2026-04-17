namespace RepoSweep.Models;

public sealed class CleanupTarget
{
    public string Name { get; set; } = "";
    public string Path { get; set; } = "";
    public long Bytes { get; set; }
    public string PrettyBytes { get; set; } = "...";
}
