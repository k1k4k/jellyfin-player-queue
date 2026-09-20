using System.Globalization;
using System.Reflection;
using Jellyfin.Plugin.QueueOsd.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.QueueOsd;

/// <summary>
/// Jellyfin Playlist : ajoute un bouton "file de lecture / saisons" au lecteur vidéo web de Jellyfin.
/// Le script client (jellyfin-queue-osd.js) est embarqué dans la DLL, servi par
/// <see cref="Controllers.QueueOsdController"/> et injecté dans index.html à la volée par
/// <see cref="Services.ScriptInjectionStartupFilter"/>. Rien n'est écrit sur le disque.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>Nom du fichier script tel qu'exposé par l'API du plugin.</summary>
    public const string ScriptFileName = "jellyfin-queue-osd.js";

    /// <summary>Segment de route de l'API du plugin.</summary>
    public const string RoutePrefix = "QueueOsd";

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "Jellyfin Playlist";

    public override Guid Id => Guid.Parse("ae203062-4b00-4c07-a7f6-83e69982d951");

    public override string Description =>
        "Bouton file de lecture dans le lecteur vidéo : saison en cours, navigation entre saisons, lecture directe d'un épisode. "
        + "Play queue button in the web video player: current season, season navigation, click-to-play.";

    /// <summary>Version du plugin, utilisée pour le cache-busting de l'URL du script.</summary>
    public static string ScriptVersion { get; } =
        (Assembly.GetExecutingAssembly().GetName().Version ?? new Version(0, 0, 0, 0)).ToString(3);

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = string.Format(CultureInfo.InvariantCulture, "{0}.Configuration.configPage.html", GetType().Namespace)
        };
    }
}
