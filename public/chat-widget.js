(function () {
  // SVG Icons
  const chatBubbleIcon = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>`;
  const closeIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  const minimizeIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>`;
  const sendIcon = `<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  const whatsappIcon = `<svg viewBox="0 0 24 24"><path d="M12.004 2c-5.51 0-9.996 4.486-9.996 9.998 0 1.761.459 3.475 1.33 4.986L2 22l5.163-1.354c1.47.801 3.125 1.222 4.837 1.222 5.51 0 9.996-4.485 9.996-9.997S17.514 2 12.004 2zm0 18.286c-1.503 0-2.98-.387-4.275-1.12l-.307-.174-3.181.834.848-3.097-.191-.304c-.799-1.272-1.22-2.738-1.22-4.254 0-4.563 3.713-8.275 8.327-8.275 4.613 0 8.328 3.712 8.328 8.275 0 4.564-3.715 8.275-8.329 8.275zM15.93 13.91c-.216-.108-1.277-.63-1.474-.702-.197-.072-.341-.108-.485.108-.144.216-.557.702-.682.846-.125.144-.251.162-.467.054a5.86 5.86 0 0 1-1.734-1.07 6.471 6.471 0 0 1-1.2-1.493c-.125-.216-.013-.333.094-.44.097-.097.216-.252.324-.379.108-.125.144-.216.216-.36.072-.144.036-.27-.018-.379-.054-.108-.485-1.17-.664-1.602-.175-.421-.349-.364-.485-.371l-.415-.008c-.144 0-.377.054-.575.27-.197.216-.755.738-.755 1.8 0 1.062.773 2.088.881 2.232.108.144 1.52 2.32 3.682 3.251.514.221.916.353 1.229.452.518.165.989.141 1.361.085.415-.062 1.277-.522 1.455-1.026.178-.504.178-.936.125-1.026-.053-.09-.197-.144-.413-.252z"/></svg>`;

  // Create markup
  const html = `
    <div class="maa-chat-container">
      <!-- Chat Window Modal -->
      <div class="maa-chat-window" id="maaChatWindow">
        <div class="maa-chat-header">
          <div class="maa-chat-title-group">
            <div class="maa-chat-avatar">M</div>
            <div class="maa-chat-info">
              <h4>Maa Engineering Support</h4>
              <div class="maa-chat-status">
                <span class="maa-status-dot"></span>
                <span>Online · Typically replies instantly</span>
              </div>
            </div>
          </div>
          <div class="maa-header-actions">
            <button class="maa-chat-minimize" id="maaChatMinimize" title="Minimize chat">${minimizeIcon}</button>
            <button class="maa-chat-close" id="maaChatClose" title="End live chat">${closeIcon}</button>
          </div>
        </div>
        
        <!-- Onboarding Screen -->
        <div class="maa-chat-onboard" id="maaOnboard">
          <p>Hi there! 👋 Enter your details to start a live chat with our engineering support team.</p>
          <div class="maa-form-group">
            <label for="chat-name">Your Name</label>
            <input type="text" id="chat-name" required placeholder="e.g. John Mensah">
          </div>
          <div class="maa-form-group">
            <label for="chat-email">Email Address</label>
            <input type="email" id="chat-email" required placeholder="e.g. john@example.com">
          </div>
          <div class="maa-form-group">
            <label for="chat-message">Your Message</label>
            <textarea id="chat-message" rows="3" required placeholder="How can we help you?"></textarea>
          </div>
          <button type="button" id="start-chat-btn">Start Live Chat</button>
        </div>

        <!-- Chat Screen (Initially Hidden) -->
        <div class="maa-chat-thread" id="maaChatThread" style="display: none;"></div>

        <!-- Chat Input Footer (Initially Hidden) -->
        <div class="maa-chat-footer" id="maaChatFooter" style="display: none;">
          <input type="text" class="maa-chat-input" id="maaChatInput" placeholder="Type a message..." autocomplete="off">
          <button class="maa-chat-send" id="maaChatSendBtn">${sendIcon}</button>
        </div>

        <!-- In-Widget Confirmation Overlay -->
        <div class="maa-chat-confirm-overlay" id="maaConfirmOverlay">
          <div class="maa-confirm-box">
            <div class="maa-confirm-icon">💬</div>
            <p class="maa-confirm-text">Are you sure you want to end this live chat session?</p>
            <div class="maa-confirm-actions">
              <button class="maa-confirm-btn danger" id="maaConfirmEnd">Yes, End Chat</button>
              <button class="maa-confirm-btn cancel" id="maaConfirmCancel">No, Keep Chatting</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Submenu -->
      <div class="maa-chat-menu" id="maaChatMenu">
        <div class="maa-menu-item" id="maaMenuWhatsapp">
          <span class="maa-menu-label">WhatsApp Us</span>
          <button class="maa-menu-btn whatsapp">${whatsappIcon}</button>
        </div>
        <div class="maa-menu-item" id="maaMenuLiveChat">
          <span class="maa-menu-label">Live Web Chat</span>
          <button class="maa-menu-btn livechat">${chatBubbleIcon}</button>
        </div>
      </div>

      <!-- Floating Trigger Button -->
      <div class="maa-chat-trigger" id="maaChatTrigger">
        <div class="maa-chat-badge" id="maaChatBadge" style="display: none;">1</div>
        <span id="trigger-icon-open">${chatBubbleIcon}</span>
        <span id="trigger-icon-close" style="display: none;">${closeIcon}</span>
      </div>
    </div>
  `;

  // Inject markup
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstElementChild);

  // DOM Elements Reference
  const trigger = document.getElementById('maaChatTrigger');
  const menu = document.getElementById('maaChatMenu');
  const chatWindow = document.getElementById('maaChatWindow');
  const minimizeBtn = document.getElementById('maaChatMinimize');
  const closeBtn = document.getElementById('maaChatClose');
  const confirmOverlay = document.getElementById('maaConfirmOverlay');
  const confirmEndBtn = document.getElementById('maaConfirmEnd');
  const confirmCancelBtn = document.getElementById('maaConfirmCancel');
  const onboard = document.getElementById('maaOnboard');
  const thread = document.getElementById('maaChatThread');
  const footer = document.getElementById('maaChatFooter');
  
  const menuWhatsapp = document.getElementById('maaMenuWhatsapp');
  const menuLiveChat = document.getElementById('maaMenuLiveChat');
  
  const startChatBtn = document.getElementById('start-chat-btn');
  const chatInput = document.getElementById('maaChatInput');
  const sendBtn = document.getElementById('maaChatSendBtn');
  const badge = document.getElementById('maaChatBadge');

  const openIconEl = document.getElementById('trigger-icon-open');
  const closeIconEl = document.getElementById('trigger-icon-close');

  let socket = null;
  let currentChatId = localStorage.getItem('maa_chat_session_id');
  let isTyping = false;
  let typingTimeout = null;

  // Fetch whatsapp redirect number dynamically
  let whatsappNum = '233596324748';
  fetch('/api/admin/settings')
    .then(r => r.json())
    .then(settings => {
      if (settings.whatsappNumber) whatsappNum = settings.whatsappNumber;
    })
    .catch(() => {});

  // Socket Connection Setup
  function initSocket() {
    if (socket) return;
    
    const socketFn = (typeof window.io === 'function') ? window.io : (typeof io === 'function' ? io : null);

    if (!socketFn) {
      console.warn('Socket.io client library is not available.');
      return;
    }

    // Connect to server (served relative to page)
    socket = socketFn();

    socket.on('connect', () => {
      console.log('Live chat connected to server.');
      if (currentChatId) {
        socket.emit('joinChat', { chatId: currentChatId });
      }
    });

    socket.on('newMessage', (msg) => {
      if (msg.chatId === currentChatId) {
        appendMessage(msg.sender, msg.text, msg.timestamp);
        
        // Show notification badge if chat window is closed
        if (!chatWindow.classList.contains('show')) {
          badge.style.display = 'flex';
        }
      }
    });

    socket.on('typing', ({ chatId, sender }) => {
      if (chatId === currentChatId && sender === 'admin') {
        showTypingIndicator();
      }
    });

    socket.on('stopTyping', ({ chatId, sender }) => {
      if (chatId === currentChatId && sender === 'admin') {
        hideTypingIndicator();
      }
    });

    socket.on('sessionClosed', ({ chatId }) => {
      if (chatId === currentChatId) {
        appendSystemMessage('This chat session has been closed by the administrator.');
        localStorage.removeItem('maa_chat_session_id');
        currentChatId = null;
        chatInput.disabled = true;
        sendBtn.disabled = true;
      }
    });
  }

  // Check if session exists and is still valid
  async function checkExistingSession() {
    if (!currentChatId) return;

    try {
      const response = await fetch(`/api/chats/${currentChatId}`);
      if (response.ok) {
        const session = await response.json();
        if (session && session.status === 'active') {
          // Init sockets & join room
          initSocket();
          
          // Fetch messages
          const msgResponse = await fetch(`/api/chats/${currentChatId}/messages`);
          const messages = await msgResponse.json();
          
          // Switch view to chat screen
          onboard.style.display = 'none';
          thread.style.display = 'flex';
          footer.style.display = 'flex';
          
          thread.innerHTML = ''; // clear loading state
          
          messages.forEach(m => {
            appendMessage(m.sender, m.text, m.timestamp);
          });
        } else {
          // Session closed or expired on server
          localStorage.removeItem('maa_chat_session_id');
          currentChatId = null;
        }
      } else {
        localStorage.removeItem('maa_chat_session_id');
        currentChatId = null;
      }
    } catch (err) {
      console.warn('Could not verify existing chat session:', err);
    }
  }

  // Append a message to the thread
  function appendMessage(sender, text, timestamp) {
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('maa-msg', sender);
    msgDiv.innerHTML = `${escapeHtml(text)}<div class="maa-msg-time">${timeStr}</div>`;
    
    // Remove typing indicator if exists before appending message
    hideTypingIndicator();
    
    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  // Append a system notification
  function appendSystemMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('maa-msg', 'system');
    msgDiv.innerText = text;
    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
  }

  // Show typing animation
  function showTypingIndicator() {
    if (document.getElementById('maaTypingIndicator')) return;
    const bubble = document.createElement('div');
    bubble.id = 'maaTypingIndicator';
    bubble.classList.add('maa-typing-bubble');
    bubble.innerHTML = `<span>Admin is typing</span><div class="maa-dot"></div><div class="maa-dot"></div><div class="maa-dot"></div>`;
    thread.appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;
  }

  // Hide typing animation
  function hideTypingIndicator() {
    const bubble = document.getElementById('maaTypingIndicator');
    if (bubble) bubble.remove();
  }

  // Escape HTML helper
  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // User typing notification handler
  function handleTyping() {
    if (!socket || !currentChatId) return;

    if (!isTyping) {
      isTyping = true;
      socket.emit('typing', { chatId: currentChatId, sender: 'user' });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit('stopTyping', { chatId: currentChatId, sender: 'user' });
    }, 2000);
  }

  // Send message function
  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (text === '') return;

    initSocket();
    
    socket.emit('sendMessage', {
      chatId: currentChatId,
      sender: 'user',
      text: text
    });

    chatInput.value = '';
    
    // Stop typing immediately on send
    if (isTyping) {
      isTyping = false;
      socket.emit('stopTyping', { chatId: currentChatId, sender: 'user' });
      clearTimeout(typingTimeout);
    }
  }

  // Start chat session handler
  startChatBtn.addEventListener('click', () => {
    const name = document.getElementById('chat-name').value.trim();
    const email = document.getElementById('chat-email').value.trim();
    const message = document.getElementById('chat-message').value.trim();

    if (name === '' || email === '' || message === '') {
      alert('Please fill out all fields to start the chat.');
      return;
    }

    initSocket();

    // Show loading thread state
    onboard.style.display = 'none';
    thread.style.display = 'flex';
    footer.style.display = 'flex';
    thread.innerHTML = '<div class="maa-msg system">Connecting to support team...</div>';

    // Start Session on server
    socket.emit('startSession', { name, email, text: message });

    // Handle session creation confirmation
    socket.once('sessionCreated', (chat) => {
      currentChatId = chat.id;
      localStorage.setItem('maa_chat_session_id', chat.id);
      
      // Update UI elements
      thread.innerHTML = '';
      appendSystemMessage('Chat session started.');
      
      // Enable inputs
      chatInput.disabled = false;
      sendBtn.disabled = false;
    });
  });

  // Action listeners
  trigger.addEventListener('click', () => {
    badge.style.display = 'none'; // hide badge on open
    const isShowingMenu = menu.classList.contains('show');
    const isShowingWindow = chatWindow.classList.contains('show');

    if (isShowingWindow) {
      // Close chat window
      chatWindow.classList.remove('show');
      openIconEl.style.display = 'block';
      closeIconEl.style.display = 'none';
      trigger.classList.remove('active');
    } else {
      // Toggle the slide-up options menu
      menu.classList.toggle('show');
      if (menu.classList.contains('show')) {
        openIconEl.style.display = 'none';
        closeIconEl.style.display = 'block';
        trigger.classList.add('active');
      } else {
        openIconEl.style.display = 'block';
        closeIconEl.style.display = 'none';
        trigger.classList.remove('active');
      }
    }
  });

  menuWhatsapp.addEventListener('click', () => {
    menu.classList.remove('show');
    openIconEl.style.display = 'block';
    closeIconEl.style.display = 'none';
    trigger.classList.remove('active');
    
    // Open whatsapp click-to-chat
    const waUrl = `https://wa.me/${whatsappNum}?text=Hello%20Maa%20Engineering%20Limited%2C%20I%20would%20like%20to%20enquire%20about%20your%20services.`;
    window.open(waUrl, '_blank');
  });

  menuLiveChat.addEventListener('click', () => {
    menu.classList.remove('show');
    chatWindow.classList.add('show');
    
    // Initialize sockets if not done
    initSocket();
    
    // Scroll chat area
    thread.scrollTop = thread.scrollHeight;
    
    // Focus input if visible
    if (footer.style.display !== 'none') {
      chatInput.focus();
    }
  });

  // Minimize button click (simply hides window without ending chat)
  minimizeBtn.addEventListener('click', () => {
    chatWindow.classList.remove('show');
    openIconEl.style.display = 'block';
    closeIconEl.style.display = 'none';
    trigger.classList.remove('active');
  });

  // Close button click (shows in-widget confirmation modal if chat session is active)
  closeBtn.addEventListener('click', () => {
    if (currentChatId) {
      confirmOverlay.classList.add('show');
    } else {
      // If no active session, simply close window
      chatWindow.classList.remove('show');
      openIconEl.style.display = 'block';
      closeIconEl.style.display = 'none';
      trigger.classList.remove('active');
    }
  });

  // Cancel ending chat session
  confirmCancelBtn.addEventListener('click', () => {
    confirmOverlay.classList.remove('show');
  });

  // Confirm ending chat session
  confirmEndBtn.addEventListener('click', () => {
    confirmOverlay.classList.remove('show');

    if (socket && currentChatId) {
      socket.emit('closeSession', { chatId: currentChatId });
    }
    localStorage.removeItem('maa_chat_session_id');
    currentChatId = null;

    // Reset UI view back to onboarding form for next session
    thread.innerHTML = '';
    thread.style.display = 'none';
    footer.style.display = 'none';
    onboard.style.display = 'flex';

    // Close chat window modal
    chatWindow.classList.remove('show');
    openIconEl.style.display = 'block';
    closeIconEl.style.display = 'none';
    trigger.classList.remove('active');
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    } else {
      handleTyping();
    }
  });

  sendBtn.addEventListener('click', sendChatMessage);

  // Initialize checks on page load
  checkExistingSession();
})();
