<#
.SYNOPSIS
    Installe (ou désinstalle) Jellyfin Playlist dans le dossier web de Jellyfin.

.DESCRIPTION
    - Copie jellyfin-queue-osd.js dans le dossier web
    - Ajoute une balise <script> dans index.html (sauvegarde index.html.queueosd.bak la 1re fois)
    - Idempotent : relancer le script met simplement à jour le .js
    - -Uninstall retire la balise et le fichier

.PARAMETER WebDir
    Dossier web de Jellyfin. Détection automatique si omis :
      C:\Program Files\Jellyfin\Server\jellyfin-web
    Peut être un chemin UNC (\\SERVEUR\partage\web).

.EXAMPLE
    .\install.ps1
    .\install.ps1 -WebDir "\\SERVEUR\jellyfin\web"
    .\install.ps1 -WebDir "\\SERVEUR\jellyfin\web" -Uninstall
#>
[CmdletBinding()]
param(
    [string]$WebDir,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$ScriptName = 'jellyfin-queue-osd.js'
$Marker     = 'jellyfin-queue-osd.js'
$Source     = Join-Path $PSScriptRoot $ScriptName

if (-not $WebDir) {
    $candidates = @(
        "$env:ProgramFiles\Jellyfin\Server\jellyfin-web",
        "${env:ProgramFiles(x86)}\Jellyfin\Server\jellyfin-web",
        "$env:LOCALAPPDATA\Programs\Jellyfin\Server\jellyfin-web"
    )
    $WebDir = $candidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'index.html')) } | Select-Object -First 1
    if (-not $WebDir) {
        throw "Dossier web Jellyfin introuvable. Indiquez-le avec -WebDir (il doit contenir index.html)."
    }
}

$IndexPath = Join-Path $WebDir 'index.html'
$BackupPath = Join-Path $WebDir 'index.html.queueosd.bak'
$OrigPath   = Join-Path $WebDir 'index.html.queueosd.orig'
$NewPath    = Join-Path $WebDir 'index.html.queueosd.new'
$TargetJs  = Join-Path $WebDir $ScriptName
$Utf8NoBom = New-Object Text.UTF8Encoding($false)

if (-not (Test-Path $IndexPath)) { throw "index.html introuvable dans $WebDir" }

# Écrit index.html. Si le fichier n'est pas réinscriptible (ex. partage Samba où
# index.html appartient à root mais le dossier est accessible en écriture), on
# écrit d'abord un .new, on met l'original de côté en .orig, puis on renomme :
# le site n'est jamais sans index.html.
function Write-Index([string]$content) {
    try {
        [IO.File]::WriteAllText($IndexPath, $content, $Utf8NoBom)
        return
    } catch [System.UnauthorizedAccessException] {
        Write-Host "index.html non réinscriptible directement, remplacement par renommage..." -ForegroundColor Yellow
    }
    [IO.File]::WriteAllText($NewPath, $content, $Utf8NoBom)
    if (Test-Path $OrigPath) { Remove-Item $OrigPath -Force }
    Move-Item -Path $IndexPath -Destination $OrigPath -Force
    Move-Item -Path $NewPath -Destination $IndexPath -Force
    Write-Host "Original conservé : $OrigPath"
}

$html = Get-Content -Path $IndexPath -Raw -Encoding UTF8

if ($Uninstall) {
    $installed = $html -match [regex]::Escape($Marker)
    if ((Test-Path $OrigPath) -and -not $installed) {
        # index.html a été remplacé depuis (mise à jour Jellyfin) : le .orig est périmé
        Remove-Item $OrigPath -Force
        Write-Host "index.html ne contient plus la balise ; $OrigPath (périmé) supprimé"
    } elseif (Test-Path $OrigPath) {
        # installation faite par renommage : on remet l'original tel quel
        Remove-Item $IndexPath -Force
        Move-Item -Path $OrigPath -Destination $IndexPath -Force
        Write-Host "index.html original restauré depuis $OrigPath"
    } else {
        $newHtml = [regex]::Replace($html, '<script[^>]*' + [regex]::Escape($Marker) + '[^>]*></script>', '')
        if ($newHtml -ne $html) {
            Write-Index $newHtml
            Write-Host "Balise <script> retirée de index.html"
        } else {
            Write-Host "Aucune balise à retirer dans index.html"
        }
    }
    if (Test-Path $TargetJs) { Remove-Item $TargetJs -Force; Write-Host "Supprimé : $TargetJs" }
    Write-Host "Désinstallation terminée." -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $Source)) { throw "$ScriptName introuvable à côté de install.ps1" }

# Version lue dans l'en-tête du script (pour le cache-busting)
$version = ([regex]::Match((Get-Content $Source -Raw), 'v(\d+\.\d+\.\d+)')).Groups[1].Value
if (-not $version) { $version = (Get-Date -Format 'yyyyMMddHHmm') }

Copy-Item -Path $Source -Destination $TargetJs -Force
Write-Host "Copié : $TargetJs"

$tag = "<script defer=`"defer`" src=`"$ScriptName`?v=$version`"></script>"

if ($html -match [regex]::Escape($Marker)) {
    # déjà installé : on met juste la version à jour
    $newHtml = [regex]::Replace($html, '<script[^>]*' + [regex]::Escape($Marker) + '[^>]*></script>', $tag)
    if ($newHtml -ne $html) {
        Write-Index $newHtml
        Write-Host "index.html : balise mise à jour (v$version)"
    } else {
        Write-Host "index.html : déjà à jour"
    }
} else {
    if (-not (Test-Path $BackupPath)) {
        Copy-Item -Path $IndexPath -Destination $BackupPath
        Write-Host "Sauvegarde : $BackupPath"
    }
    if ($html -notmatch '</head>') { throw "index.html inattendu : pas de </head>" }
    $newHtml = $html -replace '</head>', ($tag + '</head>')
    Write-Index $newHtml
    Write-Host "index.html : balise ajoutée (v$version)"
}

Write-Host "Installation terminée. Rechargez la page web de Jellyfin (Ctrl+F5)." -ForegroundColor Green
Write-Host "Note : une mise à jour de Jellyfin remplace index.html — relancez ce script ensuite." -ForegroundColor Yellow
