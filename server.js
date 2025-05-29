// server.js - BlinkChat WebSocket Server
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3000;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_MESSAGE_LENGTH = 500;

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Serve static files from root directory for main.js
app.use(express.static(__dirname));

// Serve static files from 'public' directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve index.html at the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize WebSocket server
const wss = new WebSocket.Server({ server });

// Global state for matchmaking
let waitingClient = null;

// Track all active connections
const clients = new Map();

// Client connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  // Set up client state
  ws.isAlive = true;
  ws.partnerId = null;
  const clientId = generateClientId();
  clients.set(clientId, ws);
  
  // Send client their ID
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId
  }));
  
  // Handle pong messages (heartbeat response)
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle different message types
      switch (data.type) {
        case 'chat':
          handleChatMessage(ws, data, clientId);
          break;
        case 'queue':
          handleQueueRequest(ws, clientId);
          break;
        case 'heartbeat':
          ws.isAlive = true;
          break;
        case 'typing':
          handleTypingStatus(ws, data, clientId, true);
          break;
        case 'stopped-typing':
          handleTypingStatus(ws, data, clientId, false);
          break;
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    handleDisconnect(clientId);
  });
  
  // Initial queue placement
  handleQueueRequest(ws, clientId);
});

// Handle chat messages between paired clients
function handleChatMessage(ws, data, senderId) {
  if (!ws.partnerId) return;
  
  // Validate message length
  const message = data.message.trim();
  if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) return;
  
  // Get partner websocket
  const partnerWs = clients.get(ws.partnerId);
  if (!partnerWs) return;
  
  // Forward message to partner
  partnerWs.send(JSON.stringify({
    type: 'chat',
    senderId: senderId,
    message: message,
    nickname: data.nickname
  }));
}

// Handle typing status updates between paired clients
function handleTypingStatus(ws, data, senderId, isTyping) {
  if (!ws.partnerId) return;
  
  // Get partner websocket
  const partnerWs = clients.get(ws.partnerId);
  if (!partnerWs) return;
  
  // Forward typing status to partner
  partnerWs.send(JSON.stringify({
    type: isTyping ? 'typing' : 'stopped-typing',
    senderId: senderId,
    nickname: data.nickname
  }));
}

// Handle queue/matchmaking requests
function handleQueueRequest(ws, clientId) {
  // Disconnect from current partner if any
  if (ws.partnerId) {
    const oldPartner = clients.get(ws.partnerId);
    if (oldPartner) {
      oldPartner.partnerId = null;
      oldPartner.send(JSON.stringify({ type: 'partner-left' }));
    }
    ws.partnerId = null;
  }
  
  // If someone is waiting, pair them
  if (waitingClient && waitingClient !== clientId && clients.has(waitingClient)) {
    const partnerWs = clients.get(waitingClient);
    
    // Create the pairing
    ws.partnerId = waitingClient;
    partnerWs.partnerId = clientId;
    
    // Notify both clients
    ws.send(JSON.stringify({ type: 'matched' }));
    partnerWs.send(JSON.stringify({ type: 'matched' }));
    
    // Clear waiting queue
    waitingClient = null;
  } else {
    // No one waiting, so this client waits
    waitingClient = clientId;
    ws.send(JSON.stringify({ type: 'waiting' }));
  }
}

// Handle client disconnection
function handleDisconnect(clientId) {
  const ws = clients.get(clientId);
  if (!ws) return;
  
  console.log(`Client ${clientId} disconnected`);
  
  // Notify partner if exists
  if (ws.partnerId && clients.has(ws.partnerId)) {
    const partnerWs = clients.get(ws.partnerId);
    partnerWs.partnerId = null;
    partnerWs.send(JSON.stringify({ type: 'partner-left' }));
  }
  
  // Clear waiting queue if this client was waiting
  if (waitingClient === clientId) {
    waitingClient = null;
  }
  
  // Remove from clients map
  clients.delete(clientId);
}

// Generate a unique client ID
function generateClientId() {
  return Math.random().toString(36).substring(2, 10);
}

// Heartbeat to detect and clean up dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      // Find client ID to properly clean up
      for (const [id, socket] of clients.entries()) {
        if (socket === ws) {
          handleDisconnect(id);
          return ws.terminate();
        }
      }
      return ws.terminate();
    }
    
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Start the server
server.listen(PORT, () => {
  console.log(`BlinkChat server running on http://localhost:${PORT}`);
});
