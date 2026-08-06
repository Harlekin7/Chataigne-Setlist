/*
 * Companion-Server — Setlist-Store + Live-Bridge + Dashboard-Auslieferung
 * ===========================================================================
 * Reines Node (keine npm-Abhaengigkeiten).
 *
 * Rolle:
 *   - liefert die Web-App aus (Editor + Live-Dashboard, public/index.html)
 *   - speichert die Setlist (setlist.json) als Single Source of Truth
 *   - empfaengt vom Chataigne-Modul "Setlist Index" per OSC:
 *        /song/index <int>   -> aktueller Song  (markiert ihn zusaetzlich als "gespielt")
 *        /song/reset  1      -> "gespielt"-Markierungen zuruecksetzen
 *   - schiebt den Live-Zustand per SSE ins Dashboard
 *
 * Das Triggern der Resolume-Clips passiert weiterhin komplett in Chataigne.
 *
 * Umgebungsvariablen (optional):
 *   HTTP_PORT     (Default 8080)   Web-Dashboard
 *   OSC_IN_PORT   (Default 8000)   OSC-Eingang vom Chataigne-Modul
 * ===========================================================================
 */
'use strict';

var http = require('http');
var dgram = require('dgram');
var fs = require('fs');
var path = require('path');
var E = require('../lib/setlist-engine.js');

var CFG = {
  httpPort: parseInt(process.env.HTTP_PORT, 10) || 8080,
  oscInPort: parseInt(process.env.OSC_IN_PORT, 10) || 8000
};

var SETLIST_PATH = path.join(__dirname, 'setlist.json');
var PUBLIC_DIR = path.join(__dirname, 'public');

var DEFAULT_SETLIST = {
  meta: { name: 'Neue Show' },
  songs: [
    { index: 1, name: 'Intro',            enabled: true, playedColor: '#22c55e' },
    { index: 2, name: 'Song 1 – Opener',  enabled: true, playedColor: '#22c55e' },
    { index: 3, name: 'Song 2',           enabled: true, playedColor: '#22c55e' },
    { index: 4, name: 'Ballade',          enabled: true, playedColor: '#a855f7' },
    { index: 5, name: 'Song 4 – Uptempo', enabled: true, playedColor: '#22c55e' },
    { index: 6, name: 'Zugabe',           enabled: true, playedColor: '#f97316' }
  ]
};

function loadSetlist() {
  try {
    if (fs.existsSync(SETLIST_PATH)) return E.normalizeSetlist(JSON.parse(fs.readFileSync(SETLIST_PATH, 'utf8')));
  } catch (e) { console.error('Setlist laden fehlgeschlagen:', e.message); }
  return E.normalizeSetlist(DEFAULT_SETLIST);
}
function saveSetlist(data) { fs.writeFileSync(SETLIST_PATH, JSON.stringify(data, null, 2), 'utf8'); }

var setlist = loadSetlist();
var currentIndex = -1;
var played = {};                       // { index: true }

// ---------------------------------------------------------------------------
// OSC-Decoder (nur was wir brauchen)
// ---------------------------------------------------------------------------
function oscDecode(buf) {
  function readStr(off) {
    var end = off; while (end < buf.length && buf[end] !== 0) end++;
    var str = buf.toString('utf8', off, end);
    var consumed = Math.ceil((end - off + 1) / 4) * 4;
    return { str: str, next: off + consumed };
  }
  try {
    var a = readStr(0), t = readStr(a.next);
    var types = t.str.replace(',', ''), off = t.next, args = [];
    for (var i = 0; i < types.length; i++) {
      if (types[i] === 'i') { args.push(buf.readInt32BE(off)); off += 4; }
      else if (types[i] === 'f') { args.push(buf.readFloatBE(off)); off += 4; }
      else if (types[i] === 's') { var s = readStr(off); args.push(s.str); off = s.next; }
    }
    return { address: a.str, args: args };
  } catch (e) { return null; }
}

function setCurrent(idx) {
  currentIndex = idx;
  if (idx >= 0 && E.findByIndex(setlist.songs, idx)) played[idx] = true;
  broadcastState();
}
function resetPlayed() { played = {}; broadcastState(); }

var oscIn = dgram.createSocket('udp4');
oscIn.on('message', function (msg) {
  var m = oscDecode(msg); if (!m) return;
  if (m.address === '/song/index') setCurrent(parseInt(m.args[0], 10));
  else if (m.address === '/song/reset') resetPlayed();
});
oscIn.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('WARNUNG: OSC-Port ' + CFG.oscInPort + ' ist von einem anderen Programm belegt.');
    console.error('         Das Dashboard laeuft weiter, empfaengt aber KEINE Daten aus Chataigne.');
    return;
  }
  console.error('OSC-In Fehler:', e.message);
});
try { oscIn.bind(CFG.oscInPort); } catch (e) {}

// ---------------------------------------------------------------------------
// SSE Live-Feed
// ---------------------------------------------------------------------------
var sseClients = [];
function snapshot() {
  return {
    meta: setlist.meta,
    songs: setlist.songs,
    currentIndex: currentIndex,
    played: Object.keys(played).map(Number),
    position: E.positionOf(setlist.songs, currentIndex),
    total: E.enabledOrdered(setlist.songs).length
  };
}
function broadcastState() {
  var line = 'event: state\ndata: ' + JSON.stringify(snapshot()) + '\n\n';
  for (var i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].write(line); } catch (e) { sseClients.splice(i, 1); }
  }
}
setInterval(function () {   // Heartbeat, haelt Verbindung + synct spaete Clients
  var line = ': ping\n\n';
  for (var i = sseClients.length - 1; i >= 0; i--) { try { sseClients[i].write(line); } catch (e) { sseClients.splice(i, 1); } }
}, 15000);

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  var s = ''; req.on('data', function (c) { s += c; if (s.length > 5e6) req.destroy(); });
  req.on('end', function () { try { cb(s ? JSON.parse(s) : {}); } catch (e) { cb(null); } });
}
var MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

var server = http.createServer(function (req, res) {
  var p = new URL(req.url, 'http://localhost').pathname;

  if (p === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write('retry: 2000\n\n');
    res.write('event: state\ndata: ' + JSON.stringify(snapshot()) + '\n\n');
    sseClients.push(res);
    req.on('close', function () { var i = sseClients.indexOf(res); if (i >= 0) sseClients.splice(i, 1); });
    return;
  }
  if (p === '/api/state' && req.method === 'GET') return sendJSON(res, 200, snapshot());

  if (p === '/api/setlist' && req.method === 'POST') {
    return readBody(req, function (data) {
      if (!data || !data.songs) return sendJSON(res, 400, { error: 'ungueltige Setlist' });
      setlist = E.normalizeSetlist(data);
      saveSetlist(setlist);
      broadcastState();
      sendJSON(res, 200, { ok: true, songs: setlist.songs.length });
    });
  }
  if (p === '/api/current' && req.method === 'POST') {      // manuelles Setzen / Test
    return readBody(req, function (data) { setCurrent(parseInt(data && data.index, 10)); sendJSON(res, 200, { ok: true }); });
  }
  if (p === '/api/reset' && req.method === 'POST') { resetPlayed(); return sendJSON(res, 200, { ok: true }); }

  // statische Dateien
  var file = (p === '/' ? '/index.html' : p);
  var full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(full, function (err, buf) {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('FEHLER: HTTP-Port ' + CFG.httpPort + ' ist belegt.');
    console.error('        Laeuft der Companion schon in einem anderen Fenster?');
    console.error('        Anderer Port:  set HTTP_PORT=8081  und dann neu starten.');
    process.exit(1);
  }
  throw e;
});

server.listen(CFG.httpPort, function () {
  console.log('==================================================');
  console.log(' Setlist Dashboard — Companion');
  console.log('  Dashboard:      http://localhost:' + CFG.httpPort);
  console.log('  OSC-In (Chataigne -> hier): Port ' + CFG.oscInPort);
  console.log('    /song/index <int>   /song/reset 1');
  console.log('  Songs geladen:  ' + setlist.songs.length);
  console.log('==================================================');
});
