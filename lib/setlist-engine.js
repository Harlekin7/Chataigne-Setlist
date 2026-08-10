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

/**
 * Resolves a single incoming index to the matching ROW slot (position within the
 * active list). This lets the same index appear multiple times in a setlist
 * (e.g. a song repeated as an encore) and makes the highlight "advance" cleanly
 * through the repeats instead of jumping back to the first occurrence.
 *
 * Selection rule:
 *   1) next row with this index AFTER the current slot that has not been played
 *      yet  ->  normal advance (works for repeats too)
 *   2) otherwise: first not-yet-played row with this index (jump back)
 *   3) otherwise: last row with this index (all already played -> re-fire)
 *
 * @param {Array}  list        active songs in display order (enabledOrdered)
 * @param {number} index       song index reported by the Chataigne module
 * @param {number} curSlot     current slot (-1 = none)
 * @param {Array}  playedSlots slots (positions) already played
 * @returns {number} target slot, or -1 if the index does not occur
 */
function resolveNextSlot(list, index, curSlot, playedSlots) {
  var played = playedSlots || [];
  var has = function (i) { return played.indexOf(i) >= 0; };
  var occ = [];
  for (var i = 0; i < list.length; i++) if (list[i].index === index) occ.push(i);
  if (!occ.length) return -1;
  for (var a = 0; a < occ.length; a++) if (occ[a] > curSlot && !has(occ[a])) return occ[a]; // next unplayed AFTER current
  for (var b = 0; b < occ.length; b++) if (!has(occ[b])) return occ[b];                      // else first unplayed
  return occ[occ.length - 1];                                                                // else last (re-fire)
}

var API = {
  normalizeSong: normalizeSong,
  normalizeSetlist: normalizeSetlist,
  enabledOrdered: enabledOrdered,
  findByIndex: findByIndex,
  positionOf: positionOf,
  resolveNextSlot: resolveNextSlot
};

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.SetlistEngine = API;
