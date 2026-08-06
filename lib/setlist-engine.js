/*
 * setlist-engine.js
 * ---------------------------------------------------------------------------
 * Gemeinsame, seiteneffektfreie Helfer fuer das index-getriebene System.
 *
 * Datenmodell einer Setlist:
 *   {
 *     meta:  { name: "Show 2026" },
 *     songs: [                        // Array-Reihenfolge == Anzeige-Reihenfolge (Drag&Drop)
 *       { index: 1, name: "Intro", enabled: true, playedColor: "#22c55e" },
 *       ...
 *     ]
 *   }
 *
 * WICHTIG:
 *   - "index"  = feste Identitaet des Songs (= die Nummer, die Chataigne meldet).
 *                Aendert sich NICHT beim Umsortieren.
 *   - Reihenfolge im Array = reine Anzeige-Reihenfolge (per Drag&Drop aenderbar).
 * ---------------------------------------------------------------------------
 */
'use strict';

function normalizeSong(s, i) {
  return {
    index: (s.index != null && s.index !== '') ? parseInt(s.index, 10) : (i + 1),
    name: s.name || ('Song ' + (i + 1)),
    enabled: s.enabled !== false,                 // default: aktiv
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

/** Nur aktive Songs, in Anzeige-Reihenfolge. */
function enabledOrdered(songs) {
  return (songs || []).filter(function (s) { return s.enabled !== false; });
}

/** Song-Objekt zu einer Index-Nummer finden (oder null). */
function findByIndex(songs, index) {
  for (var i = 0; i < (songs || []).length; i++) {
    if (songs[i].index === index) return songs[i];
  }
  return null;
}

/** Position (1-basiert) eines Index in der aktiven, sortierten Liste (oder 0). */
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
