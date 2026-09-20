/*!
 * Jellyfin Playlist — v0.3.0
 * https://github.com/k1k4k/jellyfin-playlist
 *
 * Ajoute une icône "file de lecture" dans le lecteur vidéo web de Jellyfin.
 * Le panneau liste les éléments de la file (épisodes suivants, playlist…) ;
 * un clic sur un élément lance sa lecture sans quitter le lecteur.
 *
 * Pour une série, le panneau affiche la saison en cours (épisodes précédents
 * compris) avec navigation entre saisons, à la Netflix ; la file de fond
 * continue normalement vers la saison suivante.
 *
 * Adds a "play queue" button to the Jellyfin web video player. For a series the
 * panel shows the current season (previous episodes included) with season
 * navigation; for anything else it lists the play queue. Clicking an item
 * plays it in place.
 *
 * Cible / target : jellyfin-web 10.10+ (développé et testé sur 12.1.0).
 * Aucune modification du bundle : le playbackManager interne est retrouvé
 * via le runtime webpack, en cherchant le module par son contenu (pas par ID).
 *
 * Licence MIT.
 */
(function () {
    'use strict';

    if (window.__jfQueueOsd) return;
    var VERSION = '0.3.0';
    window.__jfQueueOsd = { version: VERSION };

    var TAG = '[JellyfinPlaylist]';
    var pm = null;            // playbackManager (singleton)
    var panel = null;
    var refreshTimer = null;

    // Mode série ("à la Netflix") : épisodes de la série groupés par saison.
    var view = 'auto';        // 'auto' | 'queue' : 'queue' = l'utilisateur a demandé la file brute
    var series = null;        // { seriesId, seasons: [{ id, name, index, episodes: [...] }] }
    var selectedSeasonId = null;
    var lastCurrentItemId = null;

    /* ------------------------------------------------------------------ */
    /*  0. Textes FR / EN                                                  */
    /* ------------------------------------------------------------------ */

    var STRINGS = {
        fr: { queue: 'File de lecture', remaining: 'à suivre', empty: 'Aucun élément dans la file.', close: 'Fermer', watched: 'Vu', shortcut: 'Q',
              season: 'Saison', specials: 'Spéciaux', episodes: 'épisodes', prevSeason: 'Saison précédente', nextSeason: 'Saison suivante',
              showQueue: 'Voir la file de lecture', showSeasons: 'Voir les saisons', loading: 'Chargement…', loadError: 'Impossible de charger les épisodes.' },
        en: { queue: 'Play queue', remaining: 'up next', empty: 'Nothing in the queue.', close: 'Close', watched: 'Watched', shortcut: 'Q',
              season: 'Season', specials: 'Specials', episodes: 'episodes', prevSeason: 'Previous season', nextSeason: 'Next season',
              showQueue: 'Show play queue', showSeasons: 'Show seasons', loading: 'Loading…', loadError: 'Could not load episodes.' }
    };

    function getLang() {
        var l = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
        return l.indexOf('fr') === 0 ? 'fr' : 'en';
    }

    function t(key) {
        var lang = getLang();
        return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
    }

    /* ------------------------------------------------------------------ */
    /*  1. Récupération du playbackManager via le runtime webpack          */
    /* ------------------------------------------------------------------ */

    function getWebpackRequire() {
        return new Promise(function (resolve) {
            var chunks = (self.webpackChunk = self.webpackChunk || []);
            // Le runtime appelle le 3e argument avec __webpack_require__.
            // Si le runtime n'est pas encore chargé, le push est rejoué à son chargement.
            chunks.push([['jfQueueOsd_' + Date.now()], {}, function (req) { resolve(req); }]);
        });
    }

    var scannedModules = {};

    function findPlaybackManager(req) {
        var modules = req.m || {};
        var ids = Object.keys(modules);
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            if (scannedModules[id]) continue;
            scannedModules[id] = true;
            var src;
            try { src = Function.prototype.toString.call(modules[id]); } catch (e) { continue; }
            // Signature du module playbackManager (définition, pas simple usage)
            if (!/setCurrentPlaylistItem\s*[=(]/.test(src)) continue;
            if (!/getCurrentPlaylistItemId\s*[=(]/.test(src)) continue;
            if (src.indexOf('_currentPlayer') === -1) continue;
            var exp;
            try { exp = req(id); } catch (e) { continue; }
            if (!exp) continue;
            var keys = Object.keys(exp);
            for (var k = 0; k < keys.length; k++) {
                var v = exp[keys[k]];
                if (v && typeof v.getPlaylist === 'function'
                    && typeof v.setCurrentPlaylistItem === 'function'
                    && typeof v.getCurrentPlaylistItemId === 'function') {
                    return v;
                }
            }
        }
        return null;
    }

    // Le script peut être chargé avant le bundle principal (plugin d'injection) :
    // on ré-essaie tant que le module n'est pas apparu.
    function waitForPlaybackManager(req) {
        return new Promise(function (resolve, reject) {
            var started = Date.now();
            var tick = function () {
                var found = findPlaybackManager(req);
                if (found) return resolve(found);
                if (Date.now() - started > 60000) return reject(new Error('timeout'));
                setTimeout(tick, 250);
            };
            tick();
        });
    }

    /* ------------------------------------------------------------------ */
    /*  2. Helpers                                                         */
    /* ------------------------------------------------------------------ */

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function ticksToMinutes(ticks) {
        return ticks ? Math.round(ticks / 600000000) : 0;
    }

    function getImageUrl(item) {
        var api = window.ApiClient;
        if (!api || typeof api.getScaledImageUrl !== 'function') return '';
        var tags = item.ImageTags || {};
        if (tags.Primary) {
            return api.getScaledImageUrl(item.Id, { type: 'Primary', maxWidth: 320, tag: tags.Primary });
        }
        if (tags.Thumb) {
            return api.getScaledImageUrl(item.Id, { type: 'Thumb', maxWidth: 320, tag: tags.Thumb });
        }
        if (item.ParentThumbImageTag && item.ParentThumbItemId) {
            return api.getScaledImageUrl(item.ParentThumbItemId, { type: 'Thumb', maxWidth: 320, tag: item.ParentThumbImageTag });
        }
        if (item.SeriesPrimaryImageTag && item.SeriesId) {
            return api.getScaledImageUrl(item.SeriesId, { type: 'Primary', maxWidth: 320, tag: item.SeriesPrimaryImageTag });
        }
        return '';
    }

    function getEpisodeLabel(item) {
        if (item.ParentIndexNumber != null && item.IndexNumber != null) {
            return 'S' + item.ParentIndexNumber + ':E' + item.IndexNumber;
        }
        if (item.IndexNumber != null) return '#' + item.IndexNumber;
        return '';
    }

    function getSubtitle(item) {
        if (item.Type === 'Episode') return item.SeriesName || '';
        if (item.Type === 'Movie') return item.ProductionYear ? String(item.ProductionYear) : '';
        if (item.Type === 'Audio') return [item.AlbumArtist, item.Album].filter(Boolean).join(' – ');
        return item.Type || '';
    }

    function isTypingTarget(el) {
        if (!el) return false;
        var tag = (el.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    }

    /* ------------------------------------------------------------------ */
    /*  3. Styles                                                          */
    /* ------------------------------------------------------------------ */

    function injectStyles() {
        if (document.getElementById('jfQueueOsdStyle')) return;
        var css = [
            '.jfQueuePanel{position:fixed;top:5.5em;right:1.5em;bottom:9em;width:26em;max-width:calc(100vw - 3em);',
            '  display:flex;flex-direction:column;background:rgba(16,16,16,.92);color:#fff;border-radius:.5em;',
            '  box-shadow:0 .5em 2em rgba(0,0,0,.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
            '  z-index:1000;overflow:hidden;font-size:1em;pointer-events:auto;user-select:none;-webkit-user-select:none}',
            '.jfQueuePanel.hide{display:none!important}',
            '.jfQueueHeader{display:flex;align-items:center;justify-content:space-between;padding:.6em .6em .6em 1em;',
            '  border-bottom:1px solid rgba(255,255,255,.1);flex:0 0 auto}',
            '.jfQueueTitle{font-weight:600;font-size:1.05em}',
            '.jfQueueCount{opacity:.6;font-size:.85em;margin-left:.5em}',
            '.jfQueueClose{color:#fff}',
            '.jfQueueList{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:.4em 0}',
            '.jfQueueItem{display:flex;align-items:center;gap:.75em;padding:.5em 1em;cursor:pointer;',
            '  border-left:3px solid transparent;transition:background .15s}',
            '.jfQueueItem:hover,.jfQueueItem:focus{background:rgba(255,255,255,.08);outline:none}',
            '.jfQueueItem.jfQueueCurrent{border-left-color:#00a4dc;background:rgba(0,164,220,.15)}',
            '.jfQueueItem.jfQueuePast{opacity:.45}',
            '.jfQueueThumb{flex:0 0 auto;width:6.5em;aspect-ratio:16/9;background:#2a2a2a center/cover no-repeat;',
            '  border-radius:.25em;position:relative;overflow:hidden}',
            '.jfQueueThumb .material-icons{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
            '  font-size:2em;color:rgba(255,255,255,.85);text-shadow:0 0 6px #000}',
            '.jfQueueProgress{position:absolute;left:0;bottom:0;height:3px;background:#00a4dc}',
            '.jfQueueText{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:.15em}',
            '.jfQueueName{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.jfQueueMeta{font-size:.82em;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.jfQueueEmpty{padding:2em 1em;text-align:center;opacity:.6}',
            '.jfQueuePlayed{color:#fff;opacity:.8;font-size:1.1em;flex:0 0 auto}',
            '.jfQueueHeaderBtns{display:flex;align-items:center;gap:.1em}',
            '.jfQueueHeaderBtns .paper-icon-button-light{color:#fff;opacity:.8}',
            '.jfQueueSeasonBar{display:flex;align-items:center;justify-content:space-between;gap:.5em;padding:.35em .5em;',
            '  border-bottom:1px solid rgba(255,255,255,.1);flex:0 0 auto}',
            '.jfQueueSeasonBar.hide{display:none!important}',
            '.jfQueueSeasonBar .paper-icon-button-light{color:#fff}',
            '.jfQueueSeasonBar .paper-icon-button-light[disabled]{opacity:.25;pointer-events:none}',
            '.jfQueueSeasonSelect{flex:1 1 auto;min-width:0;background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.15);',
            '  border-radius:.3em;padding:.35em .5em;font:inherit;font-weight:600;text-align:center;cursor:pointer;outline:none}',
            '.jfQueueSeasonSelect option{background:#202020;color:#fff}',
            '.jfQueueItem.jfQueueSeries.jfQueuePast{opacity:1}',
            '.layout-mobile .jfQueuePanel{right:0;left:0;top:auto;bottom:0;width:auto;max-width:none;max-height:60vh;border-radius:.5em .5em 0 0}',
            '@media (max-width:600px){.jfQueuePanel{right:0;left:0;top:auto;bottom:0;width:auto;max-width:none;max-height:60vh;border-radius:.5em .5em 0 0}}'
        ].join('\n');
        var style = document.createElement('style');
        style.id = 'jfQueueOsdStyle';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    /* ------------------------------------------------------------------ */
    /*  4. Panneau                                                         */
    /* ------------------------------------------------------------------ */

    function buildPanel(page) {
        var panel = document.createElement('div');
        panel.className = 'jfQueuePanel hide';
        panel.innerHTML =
            '<div class="jfQueueHeader">' +
            '  <div><span class="jfQueueTitle">' + escapeHtml(t('queue')) + '</span><span class="jfQueueCount"></span></div>' +
            '  <div class="jfQueueHeaderBtns">' +
            '    <button type="button" class="jfQueueToggleView paper-icon-button-light autoSize hide" title="' + escapeHtml(t('showQueue')) + '">' +
            '      <span class="material-icons queue_music" aria-hidden="true"></span></button>' +
            '    <button type="button" class="jfQueueClose paper-icon-button-light autoSize" title="' + escapeHtml(t('close')) + '">' +
            '      <span class="material-icons close" aria-hidden="true"></span></button>' +
            '  </div>' +
            '</div>' +
            '<div class="jfQueueSeasonBar hide">' +
            '  <button type="button" class="jfQueueSeasonPrev paper-icon-button-light autoSize" title="' + escapeHtml(t('prevSeason')) + '">' +
            '    <span class="material-icons chevron_left" aria-hidden="true"></span></button>' +
            '  <select class="jfQueueSeasonSelect"></select>' +
            '  <button type="button" class="jfQueueSeasonNext paper-icon-button-light autoSize" title="' + escapeHtml(t('nextSeason')) + '">' +
            '    <span class="material-icons chevron_right" aria-hidden="true"></span></button>' +
            '</div>' +
            '<div class="jfQueueList"></div>';

        // Ne pas laisser l'OSD interpréter nos clics (pause, toggle OSD, etc.)
        ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel', 'contextmenu']
            .forEach(function (ev) {
                panel.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: ev === 'wheel' || ev.indexOf('touch') === 0 });
            });
        panel.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePanel(); }
        });

        panel.querySelector('.jfQueueClose').addEventListener('click', closePanel);
        panel.querySelector('.jfQueueList').addEventListener('click', onItemClick);
        panel.querySelector('.jfQueueToggleView').addEventListener('click', function () {
            view = (view === 'queue') ? 'auto' : 'queue';
            refresh();
        });
        panel.querySelector('.jfQueueSeasonPrev').addEventListener('click', function () { stepSeason(-1); });
        panel.querySelector('.jfQueueSeasonNext').addEventListener('click', function () { stepSeason(1); });
        panel.querySelector('.jfQueueSeasonSelect').addEventListener('change', function () {
            selectedSeasonId = this.value;
            renderSeries();
        });

        page.appendChild(panel);
        return panel;
    }

    function onItemClick(e) {
        var el = e.target.closest('.jfQueueItem');
        if (!el || !pm) return;
        if (el.classList.contains('jfQueueCurrent')) { closePanel(); return; }
        var playlistItemId = el.getAttribute('data-playlistitemid');
        var itemId = el.getAttribute('data-itemid');

        if (playlistItemId) {
            // déjà dans la file : on saute dessus, la file reste intacte
            try {
                pm.setCurrentPlaylistItem(playlistItemId);
            } catch (err) {
                console.error(TAG, 'setCurrentPlaylistItem failed', err);
            }
            closePanel();
            return;
        }

        if (itemId && series) {
            // épisode hors file (ex. épisode précédent) : "lire à partir d'ici",
            // la nouvelle file = cet épisode puis tout le reste de la série (toutes saisons)
            var all = allEpisodes();
            var idx = -1;
            for (var i = 0; i < all.length; i++) { if (all[i].Id === itemId) { idx = i; break; } }
            if (idx < 0) return;
            try {
                pm.play({ items: all.slice(idx), startIndex: 0 });
            } catch (err) {
                console.error(TAG, 'play failed', err);
            }
            closePanel();
        }
    }

    /* ---- mode série ---- */

    function getCurrentItem() {
        var player = null;
        try { player = pm.getCurrentPlayer(); } catch (e) { /* ignore */ }
        // 1. l'item complet du flux en cours (currentItem exige le player en argument)
        try {
            if (player && typeof pm.currentItem === 'function') {
                var it = pm.currentItem(player);
                if (it && it.Id) return it;
            }
        } catch (e) { /* ignore */ }
        // 2. l'élément courant de la file
        try {
            if (typeof pm.getItemFromPlaylistItemId === 'function') {
                var q = pm.getItemFromPlaylistItemId(pm.getCurrentPlaylistItemId(player));
                if (q && q.Item && q.Item.Id) return q.Item;
            }
        } catch (e) { /* ignore */ }
        // 3. l'état du lecteur (DTO allégé)
        try {
            var st = pm.getPlayerState(player);
            if (st && st.NowPlayingItem && st.NowPlayingItem.Id) return st.NowPlayingItem;
        } catch (e) { /* ignore */ }
        return null;
    }

    function allEpisodes() {
        var out = [];
        if (!series) return out;
        // ordre de lecture : saisons par numéro (spéciaux à la fin), épisodes par numéro
        series.seasons.forEach(function (s) { out = out.concat(s.episodes); });
        return out;
    }

    function loadSeries(seriesId) {
        var api = window.ApiClient;
        if (!api || typeof api.getEpisodes !== 'function') return Promise.reject(new Error('no ApiClient'));
        return api.getEpisodes(seriesId, {
            UserId: api.getCurrentUserId(),
            IsMissing: false,
            IsVirtualUnaired: false,
            Fields: 'MediaSources,Chapters,Trickplay',
            EnableImages: true
        }).then(function (result) {
            var items = (result && result.Items) || [];
            var bySeason = {};
            var seasons = [];
            items.forEach(function (ep) {
                var key = ep.SeasonId || ('idx' + (ep.ParentIndexNumber == null ? 'x' : ep.ParentIndexNumber));
                if (!bySeason[key]) {
                    var idx = ep.ParentIndexNumber;
                    bySeason[key] = {
                        id: key,
                        index: idx,
                        name: ep.SeasonName || (idx === 0 ? t('specials') : (idx != null ? t('season') + ' ' + idx : t('season'))),
                        episodes: []
                    };
                    seasons.push(bySeason[key]);
                }
                bySeason[key].episodes.push(ep);
            });
            var rank = function (s) { return s.index == null ? 1e9 : (s.index === 0 ? 1e9 - 1 : s.index); };
            seasons.sort(function (a, b) { return rank(a) - rank(b); });
            seasons.forEach(function (s) {
                s.episodes.sort(function (a, b) { return (a.IndexNumber || 0) - (b.IndexNumber || 0); });
            });
            return { seriesId: seriesId, seasons: seasons };
        });
    }

    function seasonIndexOf(seasonId) {
        if (!series) return -1;
        for (var i = 0; i < series.seasons.length; i++) if (series.seasons[i].id === seasonId) return i;
        return -1;
    }

    function stepSeason(delta) {
        if (!series) return;
        var i = seasonIndexOf(selectedSeasonId) + delta;
        if (i < 0 || i >= series.seasons.length) return;
        selectedSeasonId = series.seasons[i].id;
        renderSeries();
    }

    function renderSeries() {
        var list = panel.querySelector('.jfQueueList');
        var count = panel.querySelector('.jfQueueCount');
        var bar = panel.querySelector('.jfQueueSeasonBar');
        var select = panel.querySelector('.jfQueueSeasonSelect');
        var current = getCurrentItem() || {};
        var si = seasonIndexOf(selectedSeasonId);
        if (si < 0 && series.seasons.length) { si = 0; selectedSeasonId = series.seasons[0].id; }
        var season = series.seasons[si];

        bar.classList.remove('hide');
        select.innerHTML = series.seasons.map(function (s) {
            return '<option value="' + escapeHtml(s.id) + '"' + (s.id === selectedSeasonId ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>';
        }).join('');
        panel.querySelector('.jfQueueSeasonPrev').toggleAttribute('disabled', si <= 0);
        panel.querySelector('.jfQueueSeasonNext').toggleAttribute('disabled', si >= series.seasons.length - 1);

        panel.querySelector('.jfQueueTitle').textContent = current.SeriesName || t('queue');
        count.textContent = season ? season.episodes.length + ' ' + t('episodes') : '';

        // correspondance épisode -> PlaylistItemId (pour sauter sans casser la file)
        Promise.resolve(pm.getPlaylist()).then(function (queue) {
            var plid = {};
            (queue || []).forEach(function (q) { plid[q.Id] = q.PlaylistItemId; });
            var currentIdx = -1;
            (season ? season.episodes : []).forEach(function (ep, i) { if (ep.Id === current.Id) currentIdx = i; });
            list.innerHTML = (season ? season.episodes : []).map(function (ep, i) {
                return renderItem(ep, {
                    current: ep.Id === current.Id,
                    past: currentIdx >= 0 && i < currentIdx,
                    playlistItemId: plid[ep.Id] || '',
                    series: true
                });
            }).join('');
            var cur = list.querySelector('.jfQueueCurrent');
            if (cur && typeof cur.scrollIntoView === 'function') cur.scrollIntoView({ block: 'center' });
        });
    }

    function renderItem(item, o) {
        var img = getImageUrl(item);
        var label = o.series
            ? (item.IndexNumber != null ? 'E' + item.IndexNumber : '')
            : getEpisodeLabel(item);
        var mins = ticksToMinutes(item.RunTimeTicks);
        var ud = item.UserData || {};
        var pct = (ud.PlaybackPositionTicks && item.RunTimeTicks)
            ? Math.min(100, Math.round(ud.PlaybackPositionTicks * 100 / item.RunTimeTicks)) : 0;
        var meta = [o.series ? '' : getSubtitle(item), mins ? mins + ' min' : ''].filter(Boolean).join(' · ');
        var cls = 'jfQueueItem' + (o.current ? ' jfQueueCurrent' : '') + (o.past ? ' jfQueuePast' : '') + (o.series ? ' jfQueueSeries' : '');
        return '<div class="' + cls + '" tabindex="0" data-itemid="' + escapeHtml(item.Id) + '" data-playlistitemid="' + escapeHtml(o.playlistItemId || '') + '">' +
            '<div class="jfQueueThumb"' + (img ? ' style="background-image:url(&quot;' + escapeHtml(img) + '&quot;)"' : '') + '>' +
            (o.current ? '<span class="material-icons play_arrow" aria-hidden="true"></span>' : '') +
            (pct ? '<div class="jfQueueProgress" style="width:' + pct + '%"></div>' : '') +
            '</div>' +
            '<div class="jfQueueText">' +
            '  <div class="jfQueueName">' + (label ? escapeHtml(label) + ' · ' : '') + escapeHtml(item.Name) + '</div>' +
            '  <div class="jfQueueMeta">' + escapeHtml(meta) + '</div>' +
            '</div>' +
            (ud.Played ? '<span class="material-icons check jfQueuePlayed" title="' + escapeHtml(t('watched')) + '" aria-hidden="true"></span>' : '') +
            '</div>';
    }

    /* ---- mode file ---- */

    function renderList(items, currentId) {
        var list = panel.querySelector('.jfQueueList');
        var count = panel.querySelector('.jfQueueCount');
        panel.querySelector('.jfQueueSeasonBar').classList.add('hide');
        panel.querySelector('.jfQueueTitle').textContent = t('queue');
        if (!items || !items.length) {
            list.innerHTML = '<div class="jfQueueEmpty">' + escapeHtml(t('empty')) + '</div>';
            count.textContent = '';
            return;
        }
        var currentIndex = -1;
        for (var i = 0; i < items.length; i++) {
            if (items[i].PlaylistItemId === currentId) { currentIndex = i; break; }
        }
        var remaining = currentIndex >= 0 ? items.length - currentIndex - 1 : items.length;
        count.textContent = remaining + ' ' + t('remaining');

        list.innerHTML = items.map(function (item, idx) {
            return renderItem(item, {
                current: idx === currentIndex,
                past: currentIndex >= 0 && idx < currentIndex,
                playlistItemId: item.PlaylistItemId,
                series: false
            });
        }).join('');

        var cur = list.querySelector('.jfQueueCurrent');
        if (cur && typeof cur.scrollIntoView === 'function') {
            cur.scrollIntoView({ block: 'center' });
        }
    }

    function refreshQueue() {
        Promise.resolve(pm.getPlaylist()).then(function (items) {
            var currentId = pm.getCurrentPlaylistItemId();
            renderList(items || [], currentId);
        }).catch(function (err) {
            console.error(TAG, 'getPlaylist failed', err);
        });
    }

    // Complète l'item courant s'il manque SeriesId/SeasonId (DTO allégé)
    function resolveCurrent() {
        var current = getCurrentItem();
        var api = window.ApiClient;
        if (current && current.Type === 'Episode' && (!current.SeriesId || !current.SeasonId) && api && typeof api.getItem === 'function') {
            return api.getItem(api.getCurrentUserId(), current.Id).then(function (full) {
                return full || current;
            }).catch(function () { return current; });
        }
        return Promise.resolve(current);
    }

    function refresh() {
        if (!pm || !panel || panel.classList.contains('hide')) return;
        resolveCurrent().then(refreshWith);
    }

    function refreshWith(current) {
        if (!pm || !panel || panel.classList.contains('hide')) return;
        var toggle = panel.querySelector('.jfQueueToggleView');
        var isSeries = !!(current && current.Type === 'Episode' && current.SeriesId);
        console.debug(TAG, 'refresh', { type: current && current.Type, seriesId: current && current.SeriesId, seasonId: current && current.SeasonId, view: view, mode: isSeries && view !== 'queue' ? 'series' : 'queue' });
        toggle.classList.toggle('hide', !isSeries);
        toggle.title = view === 'queue' ? t('showSeasons') : t('showQueue');
        toggle.querySelector('.material-icons').className = 'material-icons ' + (view === 'queue' ? 'view_list' : 'queue_music');

        if (!isSeries || view === 'queue') { refreshQueue(); return; }

        var changedItem = current.Id !== lastCurrentItemId;
        lastCurrentItemId = current.Id;

        var ready = (series && series.seriesId === current.SeriesId)
            ? Promise.resolve(series)
            : (function () {
                panel.querySelector('.jfQueueList').innerHTML = '<div class="jfQueueEmpty">' + escapeHtml(t('loading')) + '</div>';
                return loadSeries(current.SeriesId);
            })();

        ready.then(function (data) {
            series = data;
            // suit l'épisode en cours (changement d'épisode / de saison), sinon garde la saison choisie
            if (changedItem || seasonIndexOf(selectedSeasonId) < 0) {
                selectedSeasonId = current.SeasonId || selectedSeasonId;
            }
            renderSeries();
        }).catch(function (err) {
            console.error(TAG, 'loadSeries failed', err);
            panel.querySelector('.jfQueueList').innerHTML = '<div class="jfQueueEmpty">' + escapeHtml(t('loadError')) + '</div>';
        });
    }

    function openPanel() {
        if (!panel) return;
        panel.classList.remove('hide');
        series = null;              // recharge la série à chaque ouverture (statut "vu", progression)
        lastCurrentItemId = null;
        view = 'auto';              // la vue "file brute" n'est pas mémorisée d'une ouverture à l'autre
        refresh();
        clearInterval(refreshTimer);
        // rafraîchit l'état (élément courant) pendant que le panneau est ouvert
        refreshTimer = setInterval(function () {
            if (!panel || panel.classList.contains('hide')) { clearInterval(refreshTimer); return; }
            // ne re-render que si l'élément courant a changé
            var cur = panel.querySelector('.jfQueueCurrent');
            var nowId = (getCurrentItem() || {}).Id || '';
            if (!cur || cur.getAttribute('data-itemid') !== nowId) refresh();
        }, 2000);
    }

    function closePanel() {
        if (!panel) return;
        panel.classList.add('hide');
        clearInterval(refreshTimer);
    }

    function togglePanel() {
        if (!panel) return;
        if (panel.classList.contains('hide')) openPanel(); else closePanel();
    }

    /* ------------------------------------------------------------------ */
    /*  5. Bouton dans l'OSD                                               */
    /* ------------------------------------------------------------------ */

    function ensureButton(page) {
        if (page.querySelector('.btnQueueOsd')) return;
        var settingsBtn = page.querySelector('.btnVideoOsdSettings');
        if (!settingsBtn) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btnQueueOsd autoSize paper-icon-button-light';
        btn.title = t('queue') + ' (' + t('shortcut') + ')';
        btn.setAttribute('aria-label', t('queue'));
        btn.innerHTML = '<span class="xlargePaperIconButton material-icons playlist_play" aria-hidden="true"></span>';
        // Les boutons sont en row-reverse : insérer avant "settings" le place à sa droite visuellement.
        settingsBtn.parentNode.insertBefore(btn, settingsBtn);

        // jellyfin-web peut garder plusieurs pages en cache dans le DOM :
        // chaque page vidéo a son propre panneau, activé quand on clique son bouton.
        var pagePanel = buildPanel(page);
        page.__jfQueuePanel = pagePanel;

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            activatePanel(pagePanel);
            togglePanel();
        });

        // clic hors du panneau (sur la vidéo / l'OSD) → fermeture
        page.addEventListener('click', function (e) {
            if (pagePanel.classList.contains('hide')) return;
            if (pagePanel.contains(e.target) || btn.contains(e.target)) return;
            activatePanel(pagePanel);
            closePanel();
        }, true);

        console.debug(TAG, 'button added to the video OSD');
    }

    // Rend un panneau "courant" (celui sur lequel travaillent refresh/open/close),
    // en fermant celui d'une autre page s'il était ouvert.
    function activatePanel(pagePanel) {
        if (panel && panel !== pagePanel && !panel.classList.contains('hide')) {
            panel.classList.add('hide');
            clearInterval(refreshTimer);
        }
        panel = pagePanel;
    }

    // Page vidéo actuellement affichée (les pages en cache portent la classe "hide")
    function getActiveOsdPage() {
        var pages = document.querySelectorAll('#videoOsdPage');
        var fallback = null;
        for (var i = 0; i < pages.length; i++) {
            fallback = pages[i];
            if (!pages[i].classList.contains('hide') && pages[i].offsetWidth > 0) return pages[i];
        }
        return fallback;
    }

    function onKeyDown(e) {
        if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
        if (isTypingTarget(e.target)) return;
        if ((e.key || '').toLowerCase() !== t('shortcut').toLowerCase()) return;
        var page = getActiveOsdPage();
        if (!page || !page.__jfQueuePanel) return;
        e.preventDefault();
        e.stopPropagation();
        activatePanel(page.__jfQueuePanel);
        togglePanel();
    }

    function watchForOsd() {
        var check = function () {
            var pages = document.querySelectorAll('#videoOsdPage');
            for (var i = 0; i < pages.length; i++) ensureButton(pages[i]);
        };
        check();
        var mo = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                if (muts[i].addedNodes && muts[i].addedNodes.length) { check(); return; }
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('keydown', onKeyDown, true);
    }

    /* ------------------------------------------------------------------ */
    /*  6. Init                                                            */
    /* ------------------------------------------------------------------ */

    function init() {
        injectStyles();
        getWebpackRequire().then(waitForPlaybackManager).then(function (found) {
            pm = found;
            window.__jfQueueOsd.playbackManager = pm;
            console.debug(TAG, 'v' + VERSION + ' – playbackManager found');
            if (document.body) watchForOsd();
            else document.addEventListener('DOMContentLoaded', watchForOsd);
        }).catch(function () {
            console.warn(TAG, 'playbackManager not found – unsupported jellyfin-web version?');
        });
    }

    init();
})();
