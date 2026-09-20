/*!
 * Jellyfin Queue OSD — v0.2.0
 * https://github.com/k1k4k/jellyfin-playlist
 *
 * Ajoute une icône "file de lecture" dans le lecteur vidéo web de Jellyfin.
 * Le panneau liste les éléments de la file (épisodes suivants, playlist…) ;
 * un clic sur un élément lance sa lecture sans quitter le lecteur.
 *
 * Adds a "play queue" button to the Jellyfin web video player. The panel lists
 * the queue (next episodes, playlist…); clicking an item plays it in place.
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
    var VERSION = '0.2.0';
    window.__jfQueueOsd = { version: VERSION };

    var TAG = '[QueueOSD]';
    var pm = null;            // playbackManager (singleton)
    var panel = null;
    var refreshTimer = null;

    /* ------------------------------------------------------------------ */
    /*  0. Textes FR / EN                                                  */
    /* ------------------------------------------------------------------ */

    var STRINGS = {
        fr: { queue: 'File de lecture', remaining: 'à suivre', empty: 'Aucun élément dans la file.', close: 'Fermer', watched: 'Vu', shortcut: 'Q' },
        en: { queue: 'Play queue', remaining: 'up next', empty: 'Nothing in the queue.', close: 'Close', watched: 'Watched', shortcut: 'Q' }
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
        if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
        panel = document.createElement('div');
        panel.className = 'jfQueuePanel hide';
        panel.innerHTML =
            '<div class="jfQueueHeader">' +
            '  <div><span class="jfQueueTitle">' + escapeHtml(t('queue')) + '</span><span class="jfQueueCount"></span></div>' +
            '  <button type="button" class="jfQueueClose paper-icon-button-light autoSize" title="' + escapeHtml(t('close')) + '">' +
            '    <span class="material-icons close" aria-hidden="true"></span></button>' +
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

        page.appendChild(panel);
    }

    function onItemClick(e) {
        var el = e.target.closest('.jfQueueItem');
        if (!el || !pm) return;
        var playlistItemId = el.getAttribute('data-playlistitemid');
        if (!playlistItemId) return;
        if (el.classList.contains('jfQueueCurrent')) { closePanel(); return; }
        try {
            pm.setCurrentPlaylistItem(playlistItemId);
        } catch (err) {
            console.error(TAG, 'setCurrentPlaylistItem failed', err);
        }
        closePanel();
    }

    function renderList(items, currentId) {
        var list = panel.querySelector('.jfQueueList');
        var count = panel.querySelector('.jfQueueCount');
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

        var html = items.map(function (item, idx) {
            var isCurrent = idx === currentIndex;
            var isPast = currentIndex >= 0 && idx < currentIndex;
            var img = getImageUrl(item);
            var label = getEpisodeLabel(item);
            var mins = ticksToMinutes(item.RunTimeTicks);
            var ud = item.UserData || {};
            var pct = (ud.PlaybackPositionTicks && item.RunTimeTicks)
                ? Math.min(100, Math.round(ud.PlaybackPositionTicks * 100 / item.RunTimeTicks)) : 0;
            var meta = [getSubtitle(item), mins ? mins + ' min' : ''].filter(Boolean).join(' · ');
            var cls = 'jfQueueItem' + (isCurrent ? ' jfQueueCurrent' : '') + (isPast ? ' jfQueuePast' : '');
            return '<div class="' + cls + '" tabindex="0" data-playlistitemid="' + escapeHtml(item.PlaylistItemId) + '">' +
                '<div class="jfQueueThumb"' + (img ? ' style="background-image:url(&quot;' + escapeHtml(img) + '&quot;)"' : '') + '>' +
                (isCurrent ? '<span class="material-icons play_arrow" aria-hidden="true"></span>' : '') +
                (pct ? '<div class="jfQueueProgress" style="width:' + pct + '%"></div>' : '') +
                '</div>' +
                '<div class="jfQueueText">' +
                '  <div class="jfQueueName">' + (label ? escapeHtml(label) + ' · ' : '') + escapeHtml(item.Name) + '</div>' +
                '  <div class="jfQueueMeta">' + escapeHtml(meta) + '</div>' +
                '</div>' +
                (ud.Played ? '<span class="material-icons check jfQueuePlayed" title="' + escapeHtml(t('watched')) + '" aria-hidden="true"></span>' : '') +
                '</div>';
        }).join('');
        list.innerHTML = html;

        var cur = list.querySelector('.jfQueueCurrent');
        if (cur && typeof cur.scrollIntoView === 'function') {
            cur.scrollIntoView({ block: 'center' });
        }
    }

    function refresh() {
        if (!pm || !panel || panel.classList.contains('hide')) return;
        Promise.resolve(pm.getPlaylist()).then(function (items) {
            var currentId = pm.getCurrentPlaylistItemId();
            renderList(items || [], currentId);
        }).catch(function (err) {
            console.error(TAG, 'getPlaylist failed', err);
        });
    }

    function openPanel() {
        if (!panel) return;
        panel.classList.remove('hide');
        refresh();
        clearInterval(refreshTimer);
        // rafraîchit l'état (élément courant) pendant que le panneau est ouvert
        refreshTimer = setInterval(function () {
            if (!panel || panel.classList.contains('hide')) { clearInterval(refreshTimer); return; }
            // ne re-render que si l'élément courant a changé
            var cur = panel.querySelector('.jfQueueCurrent');
            var id = pm && pm.getCurrentPlaylistItemId();
            if (!cur || cur.getAttribute('data-playlistitemid') !== id) refresh();
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
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            togglePanel();
        });
        // Les boutons sont en row-reverse : insérer avant "settings" le place à sa droite visuellement.
        settingsBtn.parentNode.insertBefore(btn, settingsBtn);

        buildPanel(page);

        // clic hors du panneau (sur la vidéo / l'OSD) → fermeture
        page.addEventListener('click', function (e) {
            if (!panel || panel.classList.contains('hide')) return;
            if (panel.contains(e.target) || btn.contains(e.target)) return;
            closePanel();
        }, true);

        console.debug(TAG, 'button added to the video OSD');
    }

    function onKeyDown(e) {
        if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
        if (isTypingTarget(e.target)) return;
        if ((e.key || '').toLowerCase() !== t('shortcut').toLowerCase()) return;
        var page = document.getElementById('videoOsdPage');
        if (!page || !panel || !page.contains(panel)) return;
        e.preventDefault();
        e.stopPropagation();
        togglePanel();
    }

    function watchForOsd() {
        var check = function () {
            var page = document.getElementById('videoOsdPage');
            if (page) ensureButton(page);
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
