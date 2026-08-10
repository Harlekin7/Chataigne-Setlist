'use strict';
/* Unit tests — run with: node test/engine.test.js */
var E = require('../lib/setlist-engine.js');
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

var raw = {
  meta: { name: 'Test' },
  songs: [
    { index: 5, name: 'A', enabled: true, playedColor: '#111' },
    { index: 2, name: 'B', enabled: false },
    { index: 9, name: 'C' }
  ]
};
var sl = E.normalizeSetlist(raw);

ok(sl.meta.name === 'Test', 'meta.name carried over');
ok(sl.songs.length === 3, '3 songs');
ok(sl.songs[0].index === 5, 'index is preserved (5)');
ok(sl.songs[1].enabled === false, 'enabled=false stays');
ok(sl.songs[2].enabled === true, 'missing enabled -> defaults to true');
ok(sl.songs[2].playedColor === '#22c55e', 'missing color -> default');

// Order = array order (NOT sorted by index!)
ok(sl.songs[0].name === 'A' && sl.songs[1].name === 'B' && sl.songs[2].name === 'C', 'array order untouched');

// enabledOrdered hides disabled songs and keeps the order
var eo = E.enabledOrdered(sl.songs);
ok(eo.length === 2 && eo[0].name === 'A' && eo[1].name === 'C', 'disabled hidden, order preserved');

// findByIndex uses the fixed index number, not the position
ok(E.findByIndex(sl.songs, 9).name === 'C', 'findByIndex(9) -> C');
ok(E.findByIndex(sl.songs, 2).name === 'B', 'findByIndex(2) -> B (even though disabled)');
ok(E.findByIndex(sl.songs, 7) === null, 'findByIndex unknown -> null');

// positionOf = 1-based position within the ACTIVE list
ok(E.positionOf(sl.songs, 5) === 1, 'positionOf(5)=1');
ok(E.positionOf(sl.songs, 9) === 2, 'positionOf(9)=2 (B is disabled and does not count)');
ok(E.positionOf(sl.songs, 2) === 0, 'positionOf(2)=0 (disabled, not in the active list)');

// Reordering changes the position, not the index number
var moved = sl.songs.slice(); var it = moved.splice(2, 1)[0]; moved.unshift(it); // move C to the front
ok(E.positionOf(moved, 9) === 1, 'after drag & drop: C is now position 1');
ok(E.findByIndex(moved, 9).index === 9, "C's index stays 9");

// --- resolveNextSlot: the same index used as a repeat advances cleanly ---
// Active list (all enabled); index 5 occurs TWICE (slot 2 in the set, slot 5 in the encore):
var L = [
  { index: 1, name: 'Intro' },     // slot 0
  { index: 2, name: 'Opener' },    // slot 1
  { index: 5, name: 'Hit' },       // slot 2  (Hit in the main set)
  { index: 3, name: 'Ballad' },    // slot 3
  { index: 4, name: 'Uptempo' },   // slot 4
  { index: 5, name: 'Hit (Encore)' } // slot 5  (same index 5!)
];
var playedS = [];
function fire(idx, cur) { var s = E.resolveNextSlot(L, idx, cur, playedS); if (s >= 0 && playedS.indexOf(s) < 0) playedS.push(s); return s; }

var c = -1;
c = fire(1, c); ok(c === 0, 'index 1 -> slot 0');
c = fire(2, c); ok(c === 1, 'index 2 -> slot 1');
c = fire(5, c); ok(c === 2, 'index 5 (first time) -> slot 2 (main set)');
c = fire(3, c); ok(c === 3, 'index 3 -> slot 3');
c = fire(4, c); ok(c === 4, 'index 4 -> slot 4');
c = fire(5, c); ok(c === 5, 'index 5 (repeat) -> slot 5 (encore), NOT back to slot 2');
// both slots with index 5 are now played -> firing again stays on the last row
c = fire(5, c); ok(c === 5, 'index 5 again (all played) -> stays on slot 5');

// unknown index -> -1 (no forced change)
ok(E.resolveNextSlot(L, 99, 3, []) === -1, 'unknown index -> -1');

console.log('\n' + pass + ' tests passed, ' + fail + ' failed.');
process.exit(fail ? 1 : 0);
