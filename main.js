// main.js - BlinkChat Frontend
// Handles UI, WebSocket communication, and nickname generation

// Import notification sound module
import { playNotificationSound } from './public/sounds/notification.js';

// ===== Configuration =====
const WS_RECONNECT_DELAY = 3000; // 3 seconds
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (shorter than server's 30s)
const MAX_MESSAGE_LENGTH = 500;
const TYPING_DEBOUNCE_DELAY = 300; // ms delay for typing indicator
const TYPING_TIMEOUT = 3000; // ms before typing indicator disappears

// ===== State =====
let socket;
let heartbeatTimer;
let reconnectTimer;
let typingTimer;
let clientId = null;
let nickname = null;
let partnerId = null;
let partnerNickname = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'waiting', 'matched'
let isTyping = false;
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false'; // Default to true

// ===== DOM Elements =====
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const nicknameElement = document.getElementById('nickname');
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const newChatBtn = document.getElementById('new-chat-btn');
const messageTemplate = document.getElementById('message-template');
const typingIndicator = document.getElementById('typing-indicator');
const typingNickname = document.getElementById('typing-nickname');
const soundToggle = document.getElementById('sound-toggle');
const soundOnIcon = document.getElementById('sound-on-icon');
const soundOffIcon = document.getElementById('sound-off-icon');

// ===== Nickname Generation =====
const adjectives = [
  'Swift', 'Brave', 'Clever', 'Daring', 'Eager', 'Fierce', 'Gentle', 'Happy',
  'Jolly', 'Kind', 'Lively', 'Mighty', 'Noble', 'Polite', 'Quick', 'Rapid',
  'Silent', 'Tough', 'Witty', 'Zealous', 'Calm', 'Proud', 'Wise', 'Agile'
];

const animals = [
  'Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Lion', 'Tiger', 'Panda', 'Koala',
  'Deer', 'Owl', 'Seal', 'Whale', 'Shark', 'Lynx', 'Raven', 'Cobra', 'Falcon',
  'Gecko', 'Hare', 'Ibex', 'Jaguar', 'Kiwi', 'Lemur', 'Moose', 'Otter'
];

function generateNickname() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${adjective}${animal}#${number}`;
}

// ===== Utility Functions =====

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait between calls
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// ===== WebSocket Management =====
function connectWebSocket() {
  // Close existing socket if any
  if (socket) {
    socket.onclose = null; // Prevent auto-reconnect for intentional close
    socket.close();
  }
  
  // Clear any existing timers
  clearInterval(heartbeatTimer);
  clearTimeout(reconnectTimer);
  clearTimeout(typingTimer);
  
  // Update UI to connecting state
  updateConnectionStatus('connecting');
  
  // Determine WebSocket URL (ws:// for http, wss:// for https)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  // Create new WebSocket connection
  socket = new WebSocket(wsUrl);
  
  // Set up event handlers
  socket.onopen = handleSocketOpen;
  socket.onmessage = handleSocketMessage;
  socket.onclose = handleSocketClose;
  socket.onerror = handleSocketError;
  
  // Start heartbeat when connected
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

function handleSocketOpen() {
  console.log('WebSocket connection established');
  // Connection established, but waiting for server to assign ID and match
  updateConnectionStatus('connecting');
}

function handleSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    // Handle different message types from server
    switch (data.type) {
      case 'connected':
        handleConnected(data);
        break;
      case 'waiting':
        updateConnectionStatus('waiting');
        break;
      case 'matched':
        updateConnectionStatus('matched');
        break;
      case 'chat':
        handleChatMessage(data, false);
        // Clear typing indicator when message is received
        hideTypingIndicator();
        break;
      case 'partner-left':
        handlePartnerLeft();
        break;
      case 'typing':
        handlePartnerTyping(data);
        break;
      case 'stopped-typing':
        hideTypingIndicator();
        break;
      default:
        console.log(`Unknown message type: ${data.type}`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
}

function handleSocketClose(event) {
  console.log(`WebSocket closed: ${event.code} ${event.reason}`);
  updateConnectionStatus('disconnected');
  
  // Clear heartbeat timer
  clearInterval(heartbeatTimer);
  
  // Attempt to reconnect after delay
  reconnectTimer = setTimeout(connectWebSocket, WS_RECONNECT_DELAY);
}

function handleSocketError(error) {
  console.error('WebSocket error:', error);
  updateConnectionStatus('disconnected');
}

function sendHeartbeat() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'heartbeat' }));
  }
}

// ===== Typing Indicator Functions =====

/**
 * Send typing status to the server
 * @param {boolean} isTyping - Whether the user is typing or not
 */
function sendTypingStatus(isTyping) {
  if (!socket || socket.readyState !== WebSocket.OPEN || connectionStatus !== 'matched') {
    return;
  }
  
  socket.send(JSON.stringify({
    type: isTyping ? 'typing' : 'stopped-typing',
    nickname: nickname
  }));
}

/**
 * Handle partner typing event
 * @param {Object} data - Typing event data
 */
function handlePartnerTyping(data) {
  // Store partner nickname for display
  partnerNickname = data.nickname;
  
  // Show typing indicator
  showTypingIndicator();
  
  // Clear previous timeout and set a new one
  clearTimeout(typingTimer);
  typingTimer = setTimeout(hideTypingIndicator, TYPING_TIMEOUT);
}

/**
 * Show the typing indicator with partner's nickname
 */
function showTypingIndicator() {
  if (partnerNickname) {
    typingNickname.textContent = partnerNickname;
    typingIndicator.classList.remove('hidden');
  }
}

/**
 * Hide the typing indicator
 */
function hideTypingIndicator() {
  typingIndicator.classList.add('hidden');
}

// Create debounced version of the typing function
const debouncedTyping = debounce(function(isTyping) {
  sendTypingStatus(isTyping);
}, TYPING_DEBOUNCE_DELAY);

// ===== Message Handling =====
function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN || connectionStatus !== 'matched') {
    return false;
  }
  
  const messageData = {
    type: 'chat',
    message: message,
    nickname: nickname
  };
  
  socket.send(JSON.stringify(messageData));
  
  // Add own message to chat
  handleChatMessage({
    senderId: clientId,
    message: message,
    nickname: nickname
  }, true);
  
  // Send stopped-typing signal when sending a message
  sendTypingStatus(false);
  
  return true;
}

function handleChatMessage(data, isOwn) {
  // Play notification sound for incoming messages
  if (!isOwn && soundEnabled) {
    playNotificationSound();
  }
  
  // Create message element from template
  const messageElement = messageTemplate.content.cloneNode(true);
  const container = messageElement.querySelector('.message-container');
  const nicknameElement = messageElement.querySelector('.nickname');
  const bubbleElement = messageElement.querySelector('.message-bubble');
  
  // Set message content
  nicknameElement.textContent = data.nickname;
  bubbleElement.textContent = data.message;
  
  // Style based on sender
  if (isOwn) {
    container.classList.add('ml-auto');
    bubbleElement.classList.add('bg-chat-primary', 'text-white');
    nicknameElement.classList.add('text-right');
  } else {
    container.classList.add('mr-auto');
    bubbleElement.classList.add('bg-chat-surface', 'text-chat-text', 'border', 'border-chat-secondary', 'border-opacity-30');
  }
  
  // Add to chat and scroll to bottom
  chatMessages.appendChild(messageElement);
  scrollToBottom();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== Connection Status Handlers =====
function handleConnected(data) {
  clientId = data.clientId;
  // Generate a new nickname when connected
  nickname = generateNickname();
  nicknameElement.textContent = nickname;
  
  // Request to join the queue
  socket.send(JSON.stringify({ type: 'queue' }));
}

function handlePartnerLeft() {
  // Clear typing indicator if visible
  hideTypingIndicator();
  
  // Add system message
  const messageElement = messageTemplate.content.cloneNode(true);
  const container = messageElement.querySelector('.message-container');
  const nicknameElement = messageElement.querySelector('.nickname');
  const bubbleElement = messageElement.querySelector('.message-bubble');
  
  nicknameElement.textContent = 'System';
  bubbleElement.textContent = 'Your chat partner has disconnected. Waiting for a new match...';
  bubbleElement.classList.add('bg-chat-secondary', 'bg-opacity-20', 'text-chat-text-secondary', 'italic');
  container.classList.add('mx-auto');
  
  chatMessages.appendChild(messageElement);
  scrollToBottom();
  
  // Update status to waiting
  updateConnectionStatus('waiting');
  
  // Request to join the queue again
  socket.send(JSON.stringify({ type: 'queue' }));
}

function updateConnectionStatus(status) {
  connectionStatus = status;
  
  // Update UI based on status
  switch (status) {
    case 'disconnected':
      statusIndicator.className = 'w-3 h-3 rounded-full bg-chat-danger mr-2';
      statusText.textContent = 'Disconnected. Reconnecting...';
      messageInput.disabled = true;
      break;
    case 'connecting':
      statusIndicator.className = 'w-3 h-3 rounded-full bg-chat-warning mr-2';
      statusText.textContent = 'Connecting...';
      messageInput.disabled = true;
      break;
    case 'waiting':
      statusIndicator.className = 'w-3 h-3 rounded-full bg-chat-warning mr-2 animate-pulse-slow';
      statusText.textContent = 'Waiting for a partner...';
      messageInput.disabled = true;
      break;
    case 'matched':
      statusIndicator.className = 'w-3 h-3 rounded-full bg-chat-success mr-2';
      statusText.textContent = 'Connected with a partner';
      messageInput.disabled = false;
      messageInput.focus();
      
      // Add system message for new match
      const messageElement = messageTemplate.content.cloneNode(true);
      const container = messageElement.querySelector('.message-container');
      const nicknameElement = messageElement.querySelector('.nickname');
      const bubbleElement = messageElement.querySelector('.message-bubble');
      
      nicknameElement.textContent = 'System';
      bubbleElement.textContent = 'You are now chatting with a stranger. Say hello!';
      bubbleElement.classList.add('bg-chat-success', 'bg-opacity-20', 'text-chat-text-secondary', 'italic');
      container.classList.add('mx-auto');
      
      chatMessages.appendChild(messageElement);
      scrollToBottom();
      break;
  }
}

// ===== Sound Settings =====

/**
 * Update the sound toggle button UI based on current state
 */
function updateSoundToggleUI() {
  if (soundEnabled) {
    soundOnIcon.classList.remove('hidden');
    soundOffIcon.classList.add('hidden');
  } else {
    soundOnIcon.classList.add('hidden');
    soundOffIcon.classList.remove('hidden');
  }
}

/**
 * Toggle sound on/off and save preference
 */
function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('soundEnabled', soundEnabled.toString());
  updateSoundToggleUI();
}

// ===== Event Listeners =====
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const message = messageInput.value.trim();
  if (message.length === 0 || message.length > MAX_MESSAGE_LENGTH) return;
  
  if (sendMessage(message)) {
    messageInput.value = '';
    messageInput.focus();
  }
});

// Typing detection
messageInput.addEventListener('input', () => {
  if (messageInput.value.trim().length > 0 && !isTyping) {
    isTyping = true;
    sendTypingStatus(true);
  } else if (messageInput.value.trim().length === 0 && isTyping) {
    isTyping = false;
    sendTypingStatus(false);
  }
  
  // Debounce typing updates to avoid spamming
  debouncedTyping(messageInput.value.trim().length > 0);
});

newChatBtn.addEventListener('click', () => {
  // Clear chat messages
  chatMessages.innerHTML = '';
  
  // Clear typing indicator
  hideTypingIndicator();
  
  // Generate new nickname
  nickname = generateNickname();
  nicknameElement.textContent = nickname;
  
  // Request to join the queue
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'queue' }));
  } else {
    connectWebSocket();
  }
});

// Sound toggle
soundToggle.addEventListener('click', toggleSound);

// Handle page visibility changes to manage connection
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Reconnect if needed when page becomes visible
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  }
});

// ===== Initialization =====
function init() {
  // Generate initial nickname
  nickname = generateNickname();
  nicknameElement.textContent = nickname;
  
  // Initialize sound toggle UI
  updateSoundToggleUI();
  
  // Connect to WebSocket server
  connectWebSocket();
}

// Start the application
init();
