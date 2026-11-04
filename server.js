// drop66 signaling server
// It only introduces two browsers to each other. Files never pass through here.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
// Works whether the page files are in a 'public' folder or loose next to this file
const PUB = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;
const INDEX = path.join(PUB, 'index.html');
const ROOM_RE = /^[a-z0-9]{6,16}$/;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/') {
    fs.readFile(INDEX, (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Could not load page');
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
    return;
  }

  // Logo and favicon
  if (['/logo.png', '/favicon.png', '/wordmark.png'].includes(url.pathname)) {
    fs.readFile(path.join(PUB, url.pathname.slice(1)), (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(data);
    });
    return;
  }

  // QR code as SVG, made on the server so the page needs no extra library
  if (url.pathname === '/qr') {
    const text = url.searchParams.get('u') || '';
    if (!text || text.length > 300) {
      res.writeHead(400);
      return res.end('Bad request');
    }
    try {
      const svg = await QRCode.toString(text, {
        type: 'svg',
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
      });
      res.end(svg);
    } catch (e) {
      res.writeHead(500);
      res.end('QR error');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ---- signaling ----
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
const rooms = new Map(); // code -> Set<ws>

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const code = url.searchParams.get('room') || '';

  if (!ROOM_RE.test(code)) {
    ws.close(1008, 'bad room');
    return;
  }

  let room = rooms.get(code);
  if (!room) {
    room = new Set();
    rooms.set(code, room);
  }

  if (room.size >= 2) {
    ws.send(JSON.stringify({ t: 'full' }));
    ws.close();
    return;
  }

  room.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  // When the second device joins, tell both. The first one makes the offer.
  if (room.size === 2) {
    const [first, second] = [...room];
    first.send(JSON.stringify({ t: 'peer', initiator: true }));
    second.send(JSON.stringify({ t: 'peer', initiator: false }));
  }

  ws.on('message', (data) => {
    // Pass connection details to the other device in the room
    for (const other of room) {
      if (other !== ws && other.readyState === 1) {
        other.send(data.toString());
      }
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    for (const other of room) {
      if (other.readyState === 1) other.send(JSON.stringify({ t: 'left' }));
    }
    if (room.size === 0) rooms.delete(code);
  });
});

// Drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

server.listen(PORT, () => {
  console.log(`drop66 running on http://localhost:${PORT}`);
});
