// main.js - BlinkChat Frontend
// Handles UI, WebSocket communication, and nickname generation

// ===== Configuration =====
const WS_RECONNECT_DELAY = 3000; // 3 seconds
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (shorter than server's 30s)
const MAX_MESSAGE_LENGTH = 500;
const TYPING_DEBOUNCE_DELAY = 300; // ms delay for typing indicator
const TYPING_TIMEOUT = 3000; // ms before typing indicator disappears
const CONTEXT_MENU_TIMEOUT = 5000; // ms before context menu auto-closes

// ===== Notification Sound =====
// Base64 encoded MP3 data for a subtle notification sound
const notificationSoundBase64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADwAD///////////////////////////////////////////8AAAA8TEFNRTMuMTAwBK8AAAAAAAAAABUgJAMGQQABmgAAA8CC3YZfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

/**
 * Creates and returns a new Audio object with the notification sound
 * @returns {Audio} HTML5 Audio object with the notification sound
 */
function createNotificationSound() {
  return new Audio(notificationSoundBase64);
}

/**
 * Plays the notification sound
 * @returns {Promise} A promise that resolves when the sound finishes playing
 */
function playNotificationSound() {
  const sound = createNotificationSound();
  return sound.play().catch(error => {
    // Handle autoplay restrictions
    console.warn('Could not play notification sound:', error);
  });
}

// ===== State =====
let socket;
let heartbeatTimer;
let reconnectTimer;
let typingTimer;
let contextMenuTimer;
let clientId = null;
let nickname = null;
let partnerId = null;
let partnerNickname = null;
let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'waiting', 'matched'
let isTyping = false;
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false'; // Default to true
let activeContextMenu = null;
let replyingToMessageId = null;
let editingMessageId = null;
let messages = new Map(); // Store messages by ID for easy reference
let messageCounter = 0; // Used to generate unique IDs

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
const replyBanner = document.getElementById('reply-banner');
const replyPreview = document.getElementById('reply-preview');
const cancelReplyBtn = document.getElementById('cancel-reply-btn');
const editBanner = document.getElementById('edit-banner');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

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

/**
 * Generate a unique message ID
 * @returns {string} Unique message ID
 */
function generateMessageId() {
  messageCounter++;
  return `msg_${Date.now()}_${messageCounter}`;
}

/**
 * Creates a context menu for message actions
 * @param {string} messageId - ID of the message
 * @param {boolean} isOwn - Whether the message is from the current user
 * @param {HTMLElement} messageElement - The message element
 * @returns {HTMLElement} The context menu element
 */
function createContextMenu(messageId, isOwn, messageElement) {
  // Remove any existing context menus
  removeContextMenu();
  
  // Create context menu
  const contextMenu = document.createElement('div');
  contextMenu.className = 'absolute z-10 bg-chat-surface rounded-lg shadow-chat-lg py-1 w-36 right-0 mt-1';
  contextMenu.id = 'context-menu';
  
  // Add actions based on message ownership
  if (isOwn) {
    // Edit option (only for own messages)
    const editOption = document.createElement('button');
    editOption.className = 'w-full text-left px-4 py-2 text-chat-text hover:bg-chat-primary hover:bg-opacity-10 flex items-center';
    editOption.innerHTML = `
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
      </svg>
      Edit
    `;
    editOption.addEventListener('click', () => {
      startEditingMessage(messageId);
      removeContextMenu();
    });
    contextMenu.appendChild(editOption);
    
    // Delete option (only for own messages)
    const deleteOption = document.createElement('button');
    deleteOption.className = 'w-full text-left px-4 py-2 text-chat-danger hover:bg-chat-danger hover:bg-opacity-10 flex items-center';
    deleteOption.innerHTML = `
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
      Delete
    `;
    deleteOption.addEventListener('click', () => {
      deleteMessage(messageId);
      removeContextMenu();
    });
    contextMenu.appendChild(deleteOption);
  }
  
  // Reply option (for all messages)
  const replyOption = document.createElement('button');
  replyOption.className = 'w-full text-left px-4 py-2 text-chat-text hover:bg-chat-primary hover:bg-opacity-10 flex items-center';
  replyOption.innerHTML = `
    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
    </svg>
    Reply
  `;
  replyOption.addEventListener('click', () => {
    startReplyingToMessage(messageId);
    removeContextMenu();
  });
  contextMenu.appendChild(replyOption);
  
  // Position context menu
  const messageRect = messageElement.getBoundingClientRect();
  contextMenu.style.position = 'absolute';
  
  // Set auto-close timer
  clearTimeout(contextMenuTimer);
  contextMenuTimer = setTimeout(removeContextMenu, CONTEXT_MENU_TIMEOUT);
  
  // Track active context menu
  activeContextMenu = contextMenu;
  
  return contextMenu;
}

/**
 * Removes any active context menu
 */
function removeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
    clearTimeout(contextMenuTimer);
  }
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
      case 'edit':
        handleMessageEdit(data);
        break;
      case 'delete':
        handleMessageDelete(data);
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

// ===== Message Actions =====

/**
 * Start editing a message
 * @param {string} messageId - ID of the message to edit
 */
function startEditingMessage(messageId) {
  const message = messages.get(messageId);
  if (!message || !message.isOwn) return;
  
  // Set editing state
  editingMessageId = messageId;
  
  // Show edit banner
  editBanner.classList.remove('hidden');
  
  // Set input value to message content
  messageInput.value = message.text;
  messageInput.focus();
  
  // Highlight the message being edited
  const messageElement = document.getElementById(messageId);
  if (messageElement) {
    messageElement.classList.add('editing');
  }
  
  // Cancel any active reply
  cancelReply();
}

/**
 * Cancel editing a message
 */
function cancelEdit() {
  if (!editingMessageId) return;
  
  // Clear editing state
  const messageElement = document.getElementById(editingMessageId);
  if (messageElement) {
    messageElement.classList.remove('editing');
  }
  
  editingMessageId = null;
  
  // Hide edit banner
  editBanner.classList.add('hidden');
  
  // Clear input
  messageInput.value = '';
}

/**
 * Save edited message
 */
function saveEdit() {
  if (!editingMessageId) return;
  
  const message = messages.get(editingMessageId);
  if (!message) return;
  
  const newText = messageInput.value.trim();
  if (newText.length === 0 || newText.length > MAX_MESSAGE_LENGTH) return;
  
  // Update message in local storage
  message.text = newText;
  message.edited = true;
  messages.set(editingMessageId, message);
  
  // Update UI
  const messageElement = document.getElementById(editingMessageId);
  if (messageElement) {
    const bubbleElement = messageElement.querySelector('.message-bubble');
    if (bubbleElement) {
      // Update message text
      bubbleElement.innerHTML = `${newText} <span class="text-xs text-chat-text-secondary ml-2">(edited)</span>`;
    }
    messageElement.classList.remove('editing');
  }
  
  // Send edit to server
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'edit',
      messageId: editingMessageId,
      message: newText,
      nickname: nickname
    }));
  }
  
  // Clear editing state
  cancelEdit();
}

/**
 * Handle message edit from partner
 * @param {Object} data - Edit data
 */
function handleMessageEdit(data) {
  const messageId = data.messageId;
  const message = messages.get(messageId);
  if (!message) return;
  
  // Update message in local storage
  message.text = data.message;
  message.edited = true;
  messages.set(messageId, message);
  
  // Update UI
  const messageElement = document.getElementById(messageId);
  if (messageElement) {
    const bubbleElement = messageElement.querySelector('.message-bubble');
    if (bubbleElement) {
      // Update message text
      bubbleElement.innerHTML = `${data.message} <span class="text-xs text-chat-text-secondary ml-2">(edited)</span>`;
    }
  }
}

/**
 * Delete a message
 * @param {string} messageId - ID of the message to delete
 */
function deleteMessage(messageId) {
  const message = messages.get(messageId);
  if (!message || !message.isOwn) return;
  
  // Update message in local storage
  message.deleted = true;
  messages.set(messageId, message);
  
  // Update UI
  const messageElement = document.getElementById(messageId);
  if (messageElement) {
    const bubbleElement = messageElement.querySelector('.message-bubble');
    if (bubbleElement) {
      // Replace message text with deletion notice
      bubbleElement.innerHTML = `<span class="italic text-chat-text-secondary">This message was deleted</span>`;
      bubbleElement.classList.add('deleted-message');
    }
  }
  
  // Send delete to server
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'delete',
      messageId: messageId,
      nickname: nickname
    }));
  }
  
  // If we're editing this message, cancel the edit
  if (editingMessageId === messageId) {
    cancelEdit();
  }
  
  // If we're replying to this message, cancel the reply
  if (replyingToMessageId === messageId) {
    cancelReply();
  }
}

/**
 * Handle message delete from partner
 * @param {Object} data - Delete data
 */
function handleMessageDelete(data) {
  const messageId = data.messageId;
  const message = messages.get(messageId);
  if (!message) return;
  
  // Update message in local storage
  message.deleted = true;
  messages.set(messageId, message);
  
  // Update UI
  const messageElement = document.getElementById(messageId);
  if (messageElement) {
    const bubbleElement = messageElement.querySelector('.message-bubble');
    if (bubbleElement) {
      // Replace message text with deletion notice
      bubbleElement.innerHTML = `<span class="italic text-chat-text-secondary">This message was deleted</span>`;
      bubbleElement.classList.add('deleted-message');
    }
  }
  
  // If we're replying to this message, cancel the reply
  if (replyingToMessageId === messageId) {
    cancelReply();
  }
}

/**
 * Start replying to a message
 * @param {string} messageId - ID of the message to reply to
 */
function startReplyingToMessage(messageId) {
  const message = messages.get(messageId);
  if (!message) return;
  
  // Set replying state
  replyingToMessageId = messageId;
  
  // Show reply banner
  replyBanner.classList.remove('hidden');
  
  // Set reply preview text
  const previewText = message.deleted 
    ? '<span class="italic">This message was deleted</span>' 
    : message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text;
  
  replyPreview.innerHTML = `
    <span class="font-medium">${message.nickname}</span>: ${previewText}
  `;
  
  // Focus input
  messageInput.focus();
  
  // Cancel any active edit
  cancelEdit();
}

/**
 * Cancel replying to a message
 */
function cancelReply() {
  replyingToMessageId = null;
  replyBanner.classList.add('hidden');
}

// ===== Message Handling =====
function sendMessage(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN || connectionStatus !== 'matched') {
    return false;
  }
  
  // Generate message ID
  const messageId = generateMessageId();
  
  // Create message data
  const messageData = {
    type: 'chat',
    messageId: messageId,
    message: message,
    nickname: nickname,
    replyTo: replyingToMessageId
  };
  
  // Send to server
  socket.send(JSON.stringify(messageData));
  
  // Add own message to chat
  handleChatMessage({
    messageId: messageId,
    senderId: clientId,
    message: message,
    nickname: nickname,
    replyTo: replyingToMessageId
  }, true);
  
  // Send stopped-typing signal when sending a message
  sendTypingStatus(false);
  
  // Clear reply state if active
  cancelReply();
  
  return true;
}

function handleChatMessage(data, isOwn) {
  // Play notification sound for incoming messages
  if (!isOwn && soundEnabled) {
    playNotificationSound();
  }
  
  // Generate ID if not provided
  const messageId = data.messageId || generateMessageId();
  
  // Store message in messages map
  messages.set(messageId, {
    id: messageId,
    text: data.message,
    nickname: data.nickname,
    isOwn: isOwn,
    timestamp: new Date(),
    edited: false,
    deleted: false,
    replyTo: data.replyTo
  });
  
  // Create message element from template
  const messageElement = messageTemplate.content.cloneNode(true);
  const container = messageElement.querySelector('.message-container');
  const nicknameElement = messageElement.querySelector('.nickname');
  const bubbleElement = messageElement.querySelector('.message-bubble');
  
  // Set message ID for reference
  container.id = messageId;
  
  // Set message content
  nicknameElement.textContent = data.nickname;
  
  // Handle reply if present
  if (data.replyTo && messages.has(data.replyTo)) {
    const replyToMessage = messages.get(data.replyTo);
    const replyElement = document.createElement('div');
    replyElement.className = 'reply-preview text-xs p-1 mb-1 border-l-2 border-chat-accent pl-2 text-chat-text-secondary';
    
    // Show reply preview
    const replyText = replyToMessage.deleted 
      ? '<span class="italic">This message was deleted</span>' 
      : replyToMessage.text.length > 30 ? replyToMessage.text.substring(0, 30) + '...' : replyToMessage.text;
    
    replyElement.innerHTML = `
      <span class="font-medium">${replyToMessage.nickname}</span>: ${replyText}
    `;
    
    bubbleElement.appendChild(replyElement);
  }
  
  // Add message text
  const messageTextElement = document.createElement('div');
  messageTextElement.textContent = data.message;
  bubbleElement.appendChild(messageTextElement);
  
  // Style based on sender
  if (isOwn) {
    container.classList.add('ml-auto');
    bubbleElement.classList.add('bg-chat-primary', 'text-white');
    nicknameElement.classList.add('text-right');
  } else {
    container.classList.add('mr-auto');
    bubbleElement.classList.add('bg-chat-surface', 'text-chat-text', 'border', 'border-chat-secondary', 'border-opacity-30');
  }
  
  // Add context menu on click
  bubbleElement.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Create and position context menu
    const menu = createContextMenu(messageId, isOwn, bubbleElement);
    bubbleElement.appendChild(menu);
  });
  
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
  
  // If editing, save edit instead of sending new message
  if (editingMessageId) {
    saveEdit();
    return;
  }
  
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
  
  // Clear message state
  messages.clear();
  cancelReply();
  cancelEdit();
  
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

// Cancel reply button
if (cancelReplyBtn) {
  cancelReplyBtn.addEventListener('click', cancelReply);
}

// Cancel edit button
if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', cancelEdit);
}

// Close context menu when clicking outside
document.addEventListener('click', (e) => {
  if (activeContextMenu && !activeContextMenu.contains(e.target)) {
    removeContextMenu();
  }
});

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
