using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.QueueOsd.Services;

/// <summary>
/// Injecte la balise &lt;script&gt; de Jellyfin Player Queue dans l'index.html de jellyfin-web au moment
/// de la requête (middleware ASP.NET enregistré via <see cref="IStartupFilter"/>).
/// Aucune écriture sur disque : pas de problème de permissions, et rien à refaire
/// après une mise à jour de Jellyfin. En cas d'erreur, la réponse d'origine est servie telle quelle.
/// </summary>
public class ScriptInjectionStartupFilter : IStartupFilter
{
    /// <summary>Marqueur d'idempotence (présent aussi dans le nom du fichier, donc une installation manuelle est détectée).</summary>
    private const string Marker = "jellyfin-queue-osd.js";

    private readonly ILogger<ScriptInjectionStartupFilter> _logger;
    private int _loggedOnce;

    public ScriptInjectionStartupFilter(ILogger<ScriptInjectionStartupFilter> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            // Avant le reste du pipeline : on est le middleware le plus externe, donc en retirant
            // Accept-Encoding on obtient de façon fiable une réponse non compressée à réécrire.
            app.Use(InvokeAsync);
            next(app);
        };
    }

    /// <summary>Balise injectée. Chemin relatif à /web/ : fonctionne aussi derrière un base-URL (/jellyfin/web/).</summary>
    internal static string BuildScriptTag()
    {
        return $"<script defer=\"defer\" src=\"../{Plugin.RoutePrefix}/{Plugin.ScriptFileName}?v={Plugin.ScriptVersion}\"></script>";
    }

    private static bool IsIndexRequest(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        return path.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/web", StringComparison.OrdinalIgnoreCase);
    }

    private async Task InvokeAsync(HttpContext context, Func<Task> nextMw)
    {
        if (!IsIndexRequest(context.Request.Path.Value) || !HttpMethods.IsGet(context.Request.Method))
        {
            await nextMw().ConfigureAwait(false);
            return;
        }

        var config = Plugin.Instance?.Configuration;
        if (config is null || !config.Enabled)
        {
            await nextMw().ConfigureAwait(false);
            return;
        }

        // Réponse complète, en clair, en 200 : pas de compression, pas de partiel.
        context.Request.Headers.Remove("Accept-Encoding");
        context.Request.Headers.Remove("Range");
        context.Request.Headers.Remove("If-Range");

        var originalBody = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await nextMw().ConfigureAwait(false);
        }
        catch
        {
            // Erreur en aval : on ne l'avale pas. Rien n'a été écrit sur le vrai flux.
            context.Response.Body = originalBody;
            throw;
        }

        context.Response.Body = originalBody;
        buffer.Seek(0, SeekOrigin.Begin);

        var isHtml = context.Response.StatusCode == StatusCodes.Status200OK
            && (context.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) ?? false);

        if (!isHtml)
        {
            // 304, redirection, autre type : inchangé.
            await buffer.CopyToAsync(originalBody).ConfigureAwait(false);
            return;
        }

        string html;
        using (var reader = new StreamReader(buffer, Encoding.UTF8, true, 1024, leaveOpen: true))
        {
            html = await reader.ReadToEndAsync().ConfigureAwait(false);
        }

        try
        {
            if (!html.Contains(Marker, StringComparison.OrdinalIgnoreCase))
            {
                var headClose = html.LastIndexOf("</head>", StringComparison.OrdinalIgnoreCase);
                if (headClose >= 0)
                {
                    html = string.Concat(html.AsSpan(0, headClose), BuildScriptTag(), html.AsSpan(headClose));
                    if (Interlocked.Exchange(ref _loggedOnce, 1) == 0)
                    {
                        _logger.LogInformation("Jellyfin Player Queue: script tag injected into index.html (request-time middleware).");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Jellyfin Player Queue: injection failed, serving original index.html.");
        }

        var bytes = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html;charset=utf-8";
        context.Response.ContentLength = bytes.Length;
        // Le corps a changé : les validateurs du gestionnaire de fichiers statiques ne sont plus valables.
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers.Remove("Accept-Ranges");
        await originalBody.WriteAsync(bytes).ConfigureAwait(false);
    }
}
