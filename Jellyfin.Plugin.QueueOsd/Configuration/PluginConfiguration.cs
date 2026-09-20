using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.QueueOsd.Configuration;

/// <summary>Configuration du plugin (Tableau de bord → Plugins → Queue OSD).</summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Injecter le script dans le client web. Décocher désactive le bouton sans désinstaller le plugin
    /// (prise en compte à la prochaine (re)charge de la page web, sans redémarrage).
    /// </summary>
    public bool Enabled { get; set; } = true;
}
