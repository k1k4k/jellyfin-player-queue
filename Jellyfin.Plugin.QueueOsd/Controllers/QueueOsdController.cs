using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.QueueOsd.Controllers;

/// <summary>Sert le script client embarqué. Anonyme : il est chargé par index.html avant toute connexion.</summary>
[ApiController]
[Route(Plugin.RoutePrefix)]
public class QueueOsdController : ControllerBase
{
    private const string ResourceName = "Jellyfin.Plugin.QueueOsd." + Plugin.ScriptFileName;

    /// <summary>GET /QueueOsd/jellyfin-queue-osd.js.</summary>
    [HttpGet(Plugin.ScriptFileName)]
    [AllowAnonymous]
    public ActionResult GetScript()
    {
        var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName);
        if (stream is null)
        {
            return NotFound();
        }

        // L'URL porte la version du plugin (?v=) : on peut cacher longtemps.
        Response.Headers["Cache-Control"] = "public, max-age=31536000, immutable";
        return new FileStreamResult(stream, "text/javascript; charset=utf-8");
    }

    /// <summary>GET /QueueOsd/status — version et état, pour la page de configuration.</summary>
    [HttpGet("status")]
    [Authorize(Policy = "RequiresElevation")]
    public ActionResult<object> GetStatus()
    {
        return new
        {
            version = Plugin.ScriptVersion,
            enabled = Plugin.Instance?.Configuration.Enabled ?? false,
            scriptTag = Services.ScriptInjectionStartupFilter.BuildScriptTag()
        };
    }
}
