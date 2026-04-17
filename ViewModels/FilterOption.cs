namespace RepoSweep.ViewModels;

public sealed record FilterOption(string Id, string Name)
{
    public override string ToString() => Name;
}
