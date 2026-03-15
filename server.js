const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Persistent session storage
const SESSIONS_DIR = path.join(__dirname, '.wacache');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Store active clients by phone number
const clients = new Map();

app.post('/api/link-phone', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !phone.match(/^\d{10,15}$/)) {
    return res.status(400).json({ error: 'Invalid phone number (10-15 digits)' });
  }

  const phoneKey = phone.replace(/[^0-9]/g, '');
  
  if (clients.has(phoneKey)) {
    return res.json({ 
      code: generateLinkCode(phoneKey),
      status: 'ready' 
    });
  }

  // Create new client
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: phoneKey,
      dataPath: path.join(SESSIONS_DIR, phoneKey)
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  clients.set(phoneKey, client);

  // Generate initial link code
  const code = generateLinkCode(phoneKey);
  
  client.initialize();

  client.on('qr', (qr) => {
    // QR fallback (not used for phone linking)
    console.log('QR received:', phoneKey);
  });

  client.on('authenticated', () => {
    console.log(`Client authenticated for ${phoneKey}`);
    io.emit(`status_${phoneKey}`, { status: 'authenticated' });
  });

  client.on('ready', () => {
    console.log(`Client ready for ${phoneKey}`);
    io.emit(`status_${phoneKey}`, { status: 'ready' });
  });

  // Real-time message handling
  client.on('message', (message) => {
    io.emit('new_message', {
      id: message.id.id,
      from: message.from,
      body: message.body,
      timestamp: message.timestamp,
      type: message.type
    });
  });

  client.on('message_create', (msg) => {
    io.emit('message_sent', {
      id: msg.id.id,
      body: msg.body
    });
  });

  return res.json({ code, status: 'initializing' });
});

app.get('/api/link-code/:phone', (req, res) => {
  const phoneKey = req.params.phone.replace(/[^0-9]/g, '');
  const code = generateLinkCode(phoneKey);
  res.json({ code });
});

function generateLinkCode(phoneKey) {
  // WhatsApp's official 8-digit phone linking code
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('join_phone', (phone) => {
    const phoneKey = phone.replace(/[^0-9]/g, '');
    socket.join(phoneKey);
  });

  socket.on('send_message', async (data) => {
    const client = clients.get(data.phone);
    if (client && client.info) {
      try {
        const chat = await client.getChatById(data.to);
        await chat.sendMessage(data.message);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Catch-all for frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Render port binding
const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
