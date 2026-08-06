/*
 * setlist-engine.js
 * ---------------------------------------------------------------------------
 * Shared, side-effect-free helpers for the index-driven system.
 *
 * Setlist data model:
 *   {
 *     meta:  { name: "Show 2026" },
 *     songs: [                        // array order == display order (drag & drop)
 *       { index: 1, name: "Intro", enabled: true, playedColor: "#22c55e" },
 *       ...
 *     ]
 *   }
 *
 * IMPORTANT:
 *   - "index"  = the song's fixed identity (= the number Chataigne reports).
 *                Reordering does NOT change it.
 *   - array order = display order only (changeable via drag & drop).
 * ---------------------------------------------------------------------------
 */
'use strict';

function normalizeSong(s, i) {
  return {
    index: (s.index != null && s.index !== '') ? parseInt(s.index, 10) : (i + 1),
    name: s.name || ('Song ' + (i + 1)),
    enabled: s.enabled !== false,                 // default: active
    playedColor: s.playedColor || '#22c55e'
  };
}

function normalizeSetlist(data) {
  data = data || {};
  return {
    meta: { name: (data.meta && data.meta.name) || 'Setlist' },
    songs: (data.songs || []).map(normalizeSong)
  };
}

/** Active songs only, in display order. */
function enabledOrdered(songs) {
  return (songs || []).filter(function (s) { return s.enabled !== false; });
}

/** The song object for an index number (or null). */
function findByIndex(songs, index) {
  for (var i = 0; i < (songs || []).length; i++) {
    if (songs[i].index === index) return songs[i];
  }
  return null;
}

/** Position (1-based) of an index within the active, ordered list (or 0). */
function positionOf(songs, index) {
  var list = enabledOrdered(songs);
  for (var i = 0; i < list.length; i++) if (list[i].index === index) return i + 1;
  return 0;
}

var API = {
  normalizeSong: normalizeSong,
  normalizeSetlist: normalizeSetlist,
  enabledOrdered: enabledOrdered,
  findByIndex: findByIndex,
  positionOf: positionOf
};

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.SetlistEngine = API;
