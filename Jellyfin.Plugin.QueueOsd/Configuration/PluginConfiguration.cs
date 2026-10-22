using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.QueueOsd.Configuration;

/// <summary>Configuration du plugin (Tableau de bord → Plugins → Jellyfin Player Queue).</summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Injecter le script dans le client web. Décocher désactive le bouton sans désinstaller le plugin
    /// (prise en compte à la prochaine (re)charge de la page web, sans redémarrage).
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Nombre maximal d'éléments dans la file en attente (ajouts depuis la bibliothèque quand rien ne joue).
    /// </summary>
    public int PendingMax { get; set; } = DefaultPendingMax;

    /// <summary>Valeur par défaut de <see cref="PendingMax"/>.</summary>
    public const int DefaultPendingMax = 200;

    /// <summary>Bornes acceptées pour <see cref="PendingMax"/>.</summary>
    public const int MinPendingMax = 10, MaxPendingMax = 2000;
}
