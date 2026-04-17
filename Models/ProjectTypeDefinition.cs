using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace RepoSweep.Models;

public sealed class ProjectTypeDefinition
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("icon")]
    public string Icon { get; set; } = "icon-folder";

    [JsonPropertyName("devicon")]
    public string? Devicon { get; set; }

    [JsonPropertyName("markers")]
    public List<string> Markers { get; set; } = new();

    [JsonPropertyName("targets")]
    public List<string> Targets { get; set; } = new();

    [JsonPropertyName("priority")]
    public int Priority { get; set; } = 5;
}
