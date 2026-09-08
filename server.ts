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

interface RoomMessage {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  rawHex?: string;
  byteLength: number;
  fileAttachment?: any;
  eventType: string;
  timestamp: number;
}

interface Room {
  code: string;
  name: string;
  createdAt: number;
  lastActive: number;
  peers: Map<string, Peer>;
  messages: RoomMessage[];
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// In-memory active rooms for phone-to-phone Bluetooth simulation relay
const rooms = new Map<string, Room>();

// Auto clean rooms older than 6 hours of inactivity
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActive > 6 * 3600 * 1000) {
      rooms.delete(code);
    }
  }
}, 60000);

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), roomCount: rooms.size });
});

// Discoverable active rooms / nearby phones
app.get('/api/rooms', (req, res) => {
  const now = Date.now();
  const activeRooms = Array.from(rooms.values())
    .filter((r) => now - r.lastActive < 30 * 60 * 1000) // active in last 30 minutes
    .map((r) => {
      const peerList = Array.from(r.peers.values()).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        os: p.os,
        mac: p.mac,
        rssi: p.rssi,
        online: now - p.lastSeen < 45000,
      }));
      return {
        code: r.code,
        name: r.name,
        peerCount: r.peers.size,
        peers: peerList,
        createdAt: r.createdAt,
        lastActive: r.lastActive,
      };
    });
  res.json({ rooms: activeRooms });
});

// Create or register room code
app.post('/api/rooms/create', (req, res) => {
  const { code, name, peerId, peerName, peerType, os, mac } = req.body;
  const roomCode = (code || Math.floor(1000 + Math.random() * 9000).toString()).toUpperCase().trim();
  const now = Date.now();

  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      code: roomCode,
      name: name || `BT-${roomCode}`,
      createdAt: now,
      lastActive: now,
      peers: new Map(),
      messages: [],
    };
    rooms.set(roomCode, room);
  } else {
    room.lastActive = now;
    if (name) room.name = name;
  }

  if (peerId) {
    room.peers.set(peerId, {
      id: peerId,
      name: peerName || 'Host Phone',
      type: peerType || 'phone',
      os: os || 'Mobile',
      mac: mac || '00:00:00:00:00:00',
      rssi: -50,
      lastSeen: now,
    });
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
  const now = Date.now();

  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      name: `BT-${code}`,
      createdAt: now,
      lastActive: now,
      peers: new Map(),
      messages: [],
    };
    rooms.set(code, room);
  }

  room.lastActive = now;

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
    lastSeen: now,
    res,
  };

  room.peers.set(peerId, peer);

  // Send initial room state to newly connected peer (include other peers)
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
      historyCount: room.messages.length,
    })}\n\n`
  );

  // Notify other peers in this room
  for (const [id, otherPeer] of room.peers.entries()) {
    if (id !== peerId && otherPeer.res) {
      try {
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
      } catch (err) {
        console.error('Failed to notify peer of join', err);
      }
    }
  }

  // SSE Keepalive heartbeat every 10 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 10000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const r = rooms.get(code);
    if (r) {
      const p = r.peers.get(peerId);
      if (p) p.res = undefined; // clear response stream but keep peer record for grace period
      // Broadcast peer_left
      for (const other of r.peers.values()) {
        if (other.res) {
          try {
            other.res.write(
              `event: peer_left\ndata: ${JSON.stringify({ peerId, name: peerName })}\n\n`
            );
          } catch {
            // ignore
          }
        }
      }
    }
  });
});

// Polling endpoint for room messages & peer status (HTTP fallback for mobile connections)
app.get('/api/rooms/:code/poll', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const peerId = req.query.peerId as string;
  const since = parseInt((req.query.since as string) || '0', 10);
  const now = Date.now();

  const room = rooms.get(code);
  if (!room) {
    return res.status(404).json({ error: 'Room not found', active: false });
  }

  room.lastActive = now;

  // Update peer heartbeat if peerId is given
  if (peerId) {
    const existing = room.peers.get(peerId);
    if (existing) {
      existing.lastSeen = now;
    }
  }

  // Return new messages after 'since' not sent by this peer
  const newMessages = room.messages.filter((m) => m.timestamp > since && m.senderId !== peerId);

  // Active peers in the room
  const peers = Array.from(room.peers.values())
    .filter((p) => p.id !== peerId && now - p.lastSeen < 60000)
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      os: p.os,
      mac: p.mac,
      rssi: p.rssi,
    }));

  res.json({
    success: true,
    code,
    messages: newMessages,
    peers,
    serverTime: now,
  });
});

// Send message or data packet to peer in room
app.post('/api/rooms/:code/send', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const { senderId, senderName, text, rawHex, byteLength, fileAttachment, eventType } = req.body;
  const now = Date.now();

  let room = rooms.get(code);
  if (!room) {
    room = {
      code,
      name: `BT-${code}`,
      createdAt: now,
      lastActive: now,
      peers: new Map(),
      messages: [],
    };
    rooms.set(code, room);
  }

  room.lastActive = now;

  const messageItem: RoomMessage = {
    id: `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
    senderId: senderId || 'unknown',
    senderName: senderName || 'Peer',
    text: text || '',
    rawHex: rawHex || '',
    byteLength: byteLength || (text ? Buffer.byteLength(text) : 0),
    fileAttachment,
    eventType: eventType || 'message',
    timestamp: now,
  };

  // Keep last 60 messages in memory
  room.messages.push(messageItem);
  if (room.messages.length > 60) {
    room.messages.splice(0, room.messages.length - 60);
  }

  const sseEvent = eventType || 'message';

  let sentCount = 0;
  for (const [id, peer] of room.peers.entries()) {
    if (id !== senderId && peer.res) {
      try {
        peer.res.write(`event: ${sseEvent}\ndata: ${JSON.stringify(messageItem)}\n\n`);
        sentCount++;
      } catch (err) {
        console.error('Failed to write to peer SSE', id, err);
      }
    }
  }

  res.json({ success: true, payload: messageItem, sentCount, timestamp: now });
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
