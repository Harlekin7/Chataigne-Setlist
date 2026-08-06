'use strict';
/* Unit-Tests — Aufruf: node test/engine.test.js */
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

ok(sl.meta.name === 'Test', 'meta.name übernommen');
ok(sl.songs.length === 3, '3 Songs');
ok(sl.songs[0].index === 5, 'Index bleibt erhalten (5)');
ok(sl.songs[1].enabled === false, 'enabled=false bleibt');
ok(sl.songs[2].enabled === true, 'fehlendes enabled -> default true');
ok(sl.songs[2].playedColor === '#22c55e', 'fehlende Farbe -> default');

// Reihenfolge = Array-Reihenfolge (NICHT nach Index sortiert!)
ok(sl.songs[0].name === 'A' && sl.songs[1].name === 'B' && sl.songs[2].name === 'C', 'Array-Reihenfolge unangetastet');

// enabledOrdered blendet deaktivierte aus, behält Reihenfolge
var eo = E.enabledOrdered(sl.songs);
ok(eo.length === 2 && eo[0].name === 'A' && eo[1].name === 'C', 'deaktivierte ausgeblendet, Reihenfolge erhalten');

// findByIndex nutzt feste Index-Nummer, nicht die Position
ok(E.findByIndex(sl.songs, 9).name === 'C', 'findByIndex(9) -> C');
ok(E.findByIndex(sl.songs, 2).name === 'B', 'findByIndex(2) -> B (auch wenn deaktiviert)');
ok(E.findByIndex(sl.songs, 7) === null, 'findByIndex unbekannt -> null');

// positionOf = 1-basierte Position in der AKTIVEN Liste
ok(E.positionOf(sl.songs, 5) === 1, 'positionOf(5)=1');
ok(E.positionOf(sl.songs, 9) === 2, 'positionOf(9)=2 (B ist deaktiviert, zählt nicht)');
ok(E.positionOf(sl.songs, 2) === 0, 'positionOf(2)=0 (deaktiviert, nicht in aktiver Liste)');

// Umsortieren ändert Position, nicht die Index-Nummer
var moved = sl.songs.slice(); var it = moved.splice(2, 1)[0]; moved.unshift(it); // C nach vorn
ok(E.positionOf(moved, 9) === 1, 'nach Drag&Drop: C jetzt Position 1');
ok(E.findByIndex(moved, 9).index === 9, 'Index von C bleibt 9');

console.log('\n' + pass + ' Tests bestanden, ' + fail + ' fehlgeschlagen.');
process.exit(fail ? 1 : 0);
