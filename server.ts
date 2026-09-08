import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface Peer {
  id: string;
  name: string;
  type: string;
  os: string;
  mac: string;
  rssi: number;
  lastSeen: number;
  res?: express.Response;
}

interface Room {
  code: string;
  name: string;
  createdAt: number;
  peers: Map<string, Peer>;
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// In-memory active rooms for phone-to-phone Bluetooth simulation relay
const rooms = new Map<string, Room>();

// Auto clean rooms older than 12 hours
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.peers.size === 0 && now - room.createdAt > 3600 * 1000) {
      rooms.delete(code);
    }
  }
}, 60000);

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// Discoverable active rooms / nearby phones
app.get('/api/rooms', (req, res) => {
  const activeRooms = Array.from(rooms.values())
    .filter((r) => r.peers.size > 0)
    .map((r) => {
      const peerList = Array.from(r.peers.values()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        os: p.os,
        mac: p.mac,
        rssi: p.rssi,
      }));
      return {
        code: r.code,
        name: r.name,
        peerCount: r.peers.size,
        peers: peerList,
        createdAt: r.createdAt,
      };
    });
  res.json({ rooms: activeRooms });
});

// Create or register room code
app.post('/api/rooms/create', (req, res) => {
  const { code, name, peerId, peerName, peerType, os, mac } = req.body;
  const roomCode = (code || Math.floor(1000 + Math.random() * 9000).toString()).toUpperCase().trim();

  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      code: roomCode,
      name: name || `BT-${roomCode}`,
      createdAt: Date.now(),
      peers: new Map(),
    };
    rooms.set(roomCode, room);
  }

  res.json({
    success: true,
    code: roomCode,
    room: {
      code: room.code,
      name: room.name,
      peerCount: room.peers.size,
    },
  });
});

// SSE Event Stream for a Room
app.get('/api/rooms/:code/events', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const peerId = (req.query.peerId as string) || `p_${Date.now()}`;
  const peerName = (req.query.name as string) || 'Mobile Phone';
  const peerType = (req.query.type as string) || 'phone';
  const os = (req.query.os as string) || 'Unknown OS';
  const mac = (req.query.mac as string) || '00:00:00:00:00:00';
  const rssi = parseInt((req.query.rssi as string) || '-60', 10);

  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      name: `BT-${code}`,
      createdAt: Date.now(),
      peers: new Map(),
    };
    rooms.set(code, room);
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const peer: Peer = {
    id: peerId,
    name: peerName,
    type: peerType,
    os,
    mac,
    rssi,
    lastSeen: Date.now(),
    res,
  };

  room.peers.set(peerId, peer);

  // Send initial room state to newly connected peer
  const existingPeers = Array.from(room.peers.values())
    .filter((p) => p.id !== peerId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      os: p.os,
      mac: p.mac,
      rssi: p.rssi,
    }));

  res.write(
    `event: connected\ndata: ${JSON.stringify({
      code,
      myPeerId: peerId,
      peers: existingPeers,
    })}\n\n`
  );

  // Notify other peers in this room
  for (const [id, otherPeer] of room.peers.entries()) {
    if (id !== peerId && otherPeer.res) {
      otherPeer.res.write(
        `event: peer_joined\ndata: ${JSON.stringify({
          id: peer.id,
          name: peer.name,
          type: peer.type,
          os: peer.os,
          mac: peer.mac,
          rssi: peer.rssi,
        })}\n\n`
      );
    }
  }

  // SSE Keepalive heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const r = rooms.get(code);
    if (r) {
      r.peers.delete(peerId);
      // Broadcast peer_left
      for (const other of r.peers.values()) {
        if (other.res) {
          other.res.write(
            `event: peer_left\ndata: ${JSON.stringify({ peerId, name: peerName })}\n\n`
          );
        }
      }
      if (r.peers.size === 0) {
        // Keep room around for 5 min in case of page refresh
        setTimeout(() => {
          const check = rooms.get(code);
          if (check && check.peers.size === 0) {
            rooms.delete(code);
          }
        }, 300000);
      }
    }
  });
});

// Send message or data packet to peer in room
app.post('/api/rooms/:code/send', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const { senderId, senderName, text, rawHex, byteLength, fileAttachment, eventType } = req.body;

  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const payload = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    senderId,
    senderName,
    text,
    rawHex,
    byteLength: byteLength || (text ? Buffer.byteLength(text) : 0),
    fileAttachment,
    timestamp: Date.now(),
  };

  const sseEvent = eventType || 'message';

  let sentCount = 0;
  for (const [id, peer] of room.peers.entries()) {
    if (id !== senderId && peer.res) {
      try {
        peer.res.write(`event: ${sseEvent}\ndata: ${JSON.stringify(payload)}\n\n`);
        sentCount++;
      } catch (err) {
        console.error('Failed to write to peer', id, err);
      }
    }
  }

  res.json({ success: true, payload, sentCount });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bluetooth Chat Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
