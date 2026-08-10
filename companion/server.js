/*
 * Companion server - setlist store, live bridge and dashboard host
 * ===========================================================================
 * Plain Node, no npm dependencies.
 *
 * Its job:
 *   - serves the web app (editor + live dashboard, public/index.html)
 *   - stores the setlist (setlist.json) as the single source of truth
 *   - receives OSC from the Chataigne module "Setlist Index":
 *        /song/index <int>   -> current song  (also marks it as played)
 *        /song/reset  1      -> clear the played marks
 *   - pushes live state into the dashboard via SSE
 *
 * Triggering the Resolume clips stays entirely inside Chataigne.
 *
 * Environment variables (optional):
 *   HTTP_PORT     (default 8080)   web dashboard
 *   OSC_IN_PORT   (default 8000)   OSC input from the Chataigne module
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
  meta: { name: 'New show' },
  songs: [
    { index: 1, name: 'Intro',            enabled: true, playedColor: '#22c55e' },
    { index: 2, name: 'Song 1 – Opener',  enabled: true, playedColor: '#22c55e' },
    { index: 3, name: 'Song 2',           enabled: true, playedColor: '#22c55e' },
    { index: 4, name: 'Ballad',           enabled: true, playedColor: '#a855f7' },
    { index: 5, name: 'Song 4 – Uptempo', enabled: true, playedColor: '#22c55e' },
    { index: 6, name: 'Encore',           enabled: true, playedColor: '#f97316' }
  ]
};

function loadSetlist() {
  try {
    if (fs.existsSync(SETLIST_PATH)) return E.normalizeSetlist(JSON.parse(fs.readFileSync(SETLIST_PATH, 'utf8')));
  } catch (e) { console.error('Loading the setlist failed:', e.message); }
  return E.normalizeSetlist(DEFAULT_SETLIST);
}
function saveSetlist(data) { fs.writeFileSync(SETLIST_PATH, JSON.stringify(data, null, 2), 'utf8'); }

var setlist = loadSetlist();
var currentSlot = -1;                  // row (position in the active list), NOT the index
var playedSlots = [];                  // played rows (positions)
function enabledList() { return E.enabledOrdered(setlist.songs); }

// ---------------------------------------------------------------------------
// OSC decoder (only what we need)
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

// The Chataigne module sends ONLY the index -> resolve the matching row (repeats advance)
function setCurrentByIndex(idx) {
  if (idx < 0) { currentSlot = -1; broadcastState(); return; }   // clear current
  var slot = E.resolveNextSlot(enabledList(), idx, currentSlot, playedSlots);
  if (slot >= 0) { currentSlot = slot; if (playedSlots.indexOf(slot) < 0) playedSlots.push(slot); }
  broadcastState();
}
// Manual/click in the dashboard: set an exact row
function setCurrentBySlot(slot) {
  var list = enabledList();
  if (slot >= 0 && slot < list.length) { currentSlot = slot; if (playedSlots.indexOf(slot) < 0) playedSlots.push(slot); }
  broadcastState();
}
function resetPlayed() { playedSlots = []; broadcastState(); }

var oscIn = dgram.createSocket('udp4');
oscIn.on('message', function (msg) {
  var m = oscDecode(msg); if (!m) return;
  if (m.address === '/song/index') setCurrentByIndex(parseInt(m.args[0], 10));
  else if (m.address === '/song/reset') resetPlayed();
});
oscIn.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('WARNING: OSC port ' + CFG.oscInPort + ' is taken by another program.');
    console.error('         The dashboard keeps running but receives NO data from Chataigne.');
    return;
  }
  console.error('OSC input error:', e.message);
});
try { oscIn.bind(CFG.oscInPort); } catch (e) {}

// ---------------------------------------------------------------------------
// SSE live feed
// ---------------------------------------------------------------------------
var sseClients = [];
function snapshot() {
  var list = enabledList();
  return {
    meta: setlist.meta,
    songs: setlist.songs,
    currentSlot: currentSlot,
    playedSlots: playedSlots.slice(),
    currentName: (currentSlot >= 0 && list[currentSlot]) ? list[currentSlot].name : null,
    position: currentSlot >= 0 ? currentSlot + 1 : 0,
    total: list.length
  };
}
function broadcastState() {
  var line = 'event: state\ndata: ' + JSON.stringify(snapshot()) + '\n\n';
  for (var i = sseClients.length - 1; i >= 0; i--) {
    try { sseClients[i].write(line); } catch (e) { sseClients.splice(i, 1); }
  }
}
setInterval(function () {   // heartbeat, keeps the connection alive and syncs late clients
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
      if (!data || !data.songs) return sendJSON(res, 400, { error: 'invalid setlist' });
      setlist = E.normalizeSetlist(data);
      saveSetlist(setlist);
      broadcastState();
      sendJSON(res, 200, { ok: true, songs: setlist.songs.length });
    });
  }
  if (p === '/api/current' && req.method === 'POST') {      // set by hand / for testing
    return readBody(req, function (data) {
      if (data && data.slot != null) setCurrentBySlot(parseInt(data.slot, 10));  // click: exact row
      else setCurrentByIndex(parseInt(data && data.index, 10));                  // like Chataigne: by index
      sendJSON(res, 200, { ok: true });
    });
  }
  if (p === '/api/reset' && req.method === 'POST') { resetPlayed(); return sendJSON(res, 200, { ok: true }); }

  // static files
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
    console.error('ERROR: HTTP port ' + CFG.httpPort + ' is already in use.');
    console.error('       Is the companion already running in another window?');
    console.error('       Another port:  set HTTP_PORT=8081  and start again.');
    process.exit(1);
  }
  throw e;
});

server.listen(CFG.httpPort, function () {
  console.log('==================================================');
  console.log(' Setlist Dashboard — Companion');
  console.log('  Dashboard:      http://localhost:' + CFG.httpPort);
  console.log('  OSC in (Chataigne -> here): port ' + CFG.oscInPort);
  console.log('    /song/index <int>   /song/reset 1');
  console.log('  Songs loaded:   ' + setlist.songs.length);
  console.log('==================================================');
});
