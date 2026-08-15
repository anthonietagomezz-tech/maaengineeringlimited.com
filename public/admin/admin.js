document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let stats = { totalInquiries: 0, unreadInquiries: 0, repliedInquiries: 0, activeChats: 0 };
  let inquiries = [];
  let selectedInquiryId = null;
  let chatSessions = [];
  let selectedChatId = null;
  let socket = null;
  let isTyping = false;
  let typingTimeout = null;

  // DOM Elements - Login Screens
  const loginScreen = document.getElementById('login-screen');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const adminDashboard = document.getElementById('admin-dashboard');
  const logoutTrigger = document.getElementById('logout-trigger');
  const adminUserDisplay = document.getElementById('admin-user-display');

  // DOM Elements - Nav/Headers
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const tabTitleDisplay = document.getElementById('tab-title-display');
  const tabSubtitleDisplay = document.getElementById('tab-subtitle-display');
  
  // DOM Elements - Badges
  const badgeInquiries = document.getElementById('badge-inquiries');
  const badgeChats = document.getElementById('badge-chats');

  // 1. INITIAL AUTHENTICATION CHECK
  async function checkAuth() {
    try {
      const response = await fetch('/api/admin/check-auth');
      if (response.ok) {
        const data = await response.json();
        showDashboard(data.username);
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.style.display = 'flex';
    adminDashboard.style.display = 'none';
  }

  function showDashboard(username) {
    loginScreen.style.display = 'none';
    adminDashboard.style.display = 'flex';
    adminUserDisplay.innerText = username || 'Administrator';
    
    // Init Live dashboard logic
    initDashboard();
  }

  // Handle Login Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    loginError.style.display = 'none';

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        showDashboard(username);
        loginForm.reset();
      } else {
        const data = await response.json();
        loginError.innerText = data.error || 'Invalid credentials.';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.innerText = 'Failed to connect to the server.';
      loginError.style.display = 'block';
    }
  });

  // Handle Logout
  logoutTrigger.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      showLogin();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  });


  // ==========================================
  // 2. DASHBOARD ORCHESTRATOR
  // ==========================================
  function initDashboard() {
    // 1. Setup real-time Socket.io sync
    setupSocket();

    // 2. Load tab-specific click routing
    setupTabNavigation();

    // 3. Fetch statistics & update cards
    fetchStats();

    // 4. Default view: Load Overview tab
    loadTab('overview');
  }

  // Icons & Sound Helper
  const doubleCheckIcon = `<span class="wa-double-check"><svg viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17l-4.24-4.24-1.41 1.41 5.66 5.66L23.66 7l-1.42-1.41zM.41 13.34l5.66 5.66 1.41-1.41-5.66-5.66-1.41 1.41z"/></svg></span>`;
  let targetWaNumber = '233204437721';

  function playChimeSound() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  }

  // Socket.io operators configuration
  function setupSocket() {
    if (socket) return;
    
    const socketFn = (typeof window.io === 'function') ? window.io : (typeof io === 'function' ? io : null);
    if (!socketFn) {
      console.warn('Socket.io client library is not loaded on admin portal.');
      return;
    }
    
    socket = socketFn();

    socket.on('connect', () => {
      console.log('Admin socket connection established.');
    });

    // Real-time notification: New Inquiry
    socket.on('newInquiry', (newMsg) => {
      fetchStats();
      playChimeSound();
      if (document.getElementById('panel-overview').classList.contains('active')) {
        refreshOverviewLists();
      }
      if (document.getElementById('panel-inquiries').classList.contains('active')) {
        fetchInquiries();
      }
      showToastAlert(`New project enquiry received from ${newMsg.name}!`);
    });

    // Real-time notification: New Inquiry Reply
    socket.on('newInquiryReply', ({ messageId, reply }) => {
      fetchStats();
      if (selectedInquiryId && selectedInquiryId === messageId) {
        appendInquiryReplyBubble(reply);
      }
      if (document.getElementById('panel-inquiries').classList.contains('active')) {
        fetchInquiries();
      }
    });

    socket.on('inquiryListUpdate', () => {
      fetchInquiries();
      fetchStats();
    });

    // Real-time notification: New Chat Session
    socket.on('newChatSession', (newSession) => {
      fetchStats();
      refreshChatList();
      playChimeSound();
      showToastAlert(`New live chat started by ${newSession.name}!`);
    });

    // Chat Updates
    socket.on('chatListUpdate', () => {
      refreshChatList();
      fetchStats();
    });

    // Real-time message receiver
    socket.on('newMessage', (msg) => {
      if (selectedChatId && msg.chatId === selectedChatId) {
        appendChatMsg(msg.sender, msg.text, msg.timestamp);
        if (msg.sender === 'user') playChimeSound();
        scrollChatThread();
      }
    });

    socket.on('typing', ({ chatId, sender }) => {
      if (selectedChatId && chatId === selectedChatId && sender === 'user') {
        const activeChat = chatSessions.find(c => c.id === selectedChatId);
        const visitorName = (activeChat && activeChat.name) ? activeChat.name.split(' ')[0] : 'Client';
        const typingText = document.querySelector('#visitor-typing-alert span:last-child');
        if (typingText) typingText.innerText = `${visitorName} is typing...`;
        const el = document.getElementById('visitor-typing-alert');
        if (el) el.style.display = 'flex';
      }
    });

    socket.on('stopTyping', ({ chatId, sender }) => {
      if (selectedChatId && chatId === selectedChatId && sender === 'user') {
        const el = document.getElementById('visitor-typing-alert');
        if (el) el.style.display = 'none';
      }
    });

    socket.on('sessionClosed', ({ chatId }) => {
      if (selectedChatId && chatId === selectedChatId) {
        appendChatSystemMsg('The session has been closed.');
        document.getElementById('chat-operator-input').disabled = true;
        document.getElementById('chat-operator-send').disabled = true;
        refreshChatList();
      }
    });
  }

  // Custom Toast Message Alert
  function showToastAlert(text) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '20px';
    toast.style.background = '#ffffff';
    toast.style.borderLeft = '4px solid #c89b55';
    toast.style.border = '1px solid #e9ecef';
    toast.style.borderLeftWidth = '4px';
    toast.style.borderLeftColor = '#c89b55';
    toast.style.color = '#111315';
    toast.style.padding = '14px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
    toast.style.zIndex = '99999';
    toast.style.fontSize = '13.5px';
    toast.style.fontWeight = '600';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.style.animation = 'fadeIn 0.3s ease-out';
    toast.innerText = text;

    document.body.appendChild(toast);
    
    // Auto-remove after 4s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // Sidebar Tab Routing Handler
  function setupTabNavigation() {
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        loadTab(tab);
      });
    });
  }

  function loadTab(tab) {
    // 1. Toggle Active Link Style
    navItems.forEach(i => i.classList.remove('active'));
    document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');

    // 2. Toggle Active Panel Style
    tabPanels.forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${tab}`).classList.add('active');

    // 3. Set Header Titles
    updateHeaderTitles(tab);

    // 4. Fetch/Load Tab Specific Data
    switch (tab) {
      case 'overview':
        refreshOverviewLists();
        break;
      case 'inquiries':
        fetchInquiries();
        break;
      case 'livechat':
        refreshChatList();
        break;
      case 'settings':
        fetchSettings();
        break;
    }
  }

  function updateHeaderTitles(tab) {
    const titles = {
      overview: { title: 'Overview Dashboard', subtitle: 'Real-time metrics, active chat statistics, and recent enquiries.' },
      inquiries: { title: 'Inquiry Inbox', subtitle: 'Manage submissions, view client interest details, and compose replies.' },
      livechat: { title: 'Live Chat Operator', subtitle: 'Chat with visitors browsing your website in real-time.' },
      settings: { title: 'System Settings', subtitle: 'Change passwords, update WhatsApp numbers, and configure SMTP gateway servers.' }
    };
    
    tabTitleDisplay.innerText = titles[tab].title;
    tabSubtitleDisplay.innerText = titles[tab].subtitle;
  }

  // Fetch Dashboard Stats Counts
  async function fetchStats() {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        stats = await response.json();
        
        // Populate DOM elements
        document.getElementById('stat-total-inquiries').innerText = stats.totalInquiries;
        document.getElementById('stat-unread-inquiries').innerText = stats.unreadInquiries;
        document.getElementById('stat-active-chats').innerText = stats.activeChats;
        document.getElementById('stat-replied-inquiries').innerText = stats.repliedInquiries;

        // Side navigation badges
        if (stats.unreadInquiries > 0) {
          badgeInquiries.innerText = stats.unreadInquiries;
          badgeInquiries.style.display = 'inline-block';
        } else {
          badgeInquiries.style.display = 'none';
        }

        if (stats.activeChats > 0) {
          badgeChats.innerText = stats.activeChats;
          badgeChats.style.display = 'inline-block';
        } else {
          badgeChats.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }


  // ==========================================
  // 3. TAB LOGIC: OVERVIEW
  // ==========================================
  async function refreshOverviewLists() {
    const inquiriesContainer = document.getElementById('recent-inquiries-list');
    const chatsContainer = document.getElementById('recent-chats-list');
    
    inquiriesContainer.innerHTML = '<div class="loading-spinner">Loading inquiries...</div>';
    chatsContainer.innerHTML = '<div class="loading-spinner">Loading chats...</div>';

    try {
      // 1. Fetch Inquiries
      const resMsg = await fetch('/api/admin/messages');
      const messages = await resMsg.json();
      
      inquiriesContainer.innerHTML = '';
      if (messages.length === 0) {
        inquiriesContainer.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center; font-size:13px;">No inquiries found.</div>';
      } else {
        // Take top 4
        messages.slice(0, 4).forEach(m => {
          const div = document.createElement('div');
          div.style.background = 'var(--bg-primary)';
          div.style.border = '1px solid var(--border-color)';
          div.style.padding = '14px 18px';
          div.style.borderRadius = '8px';
          div.style.cursor = 'pointer';
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          div.style.transition = 'all 0.2s';
          
          div.onmouseover = () => { div.style.borderColor = 'var(--color-accent)'; };
          div.onmouseout = () => { div.style.borderColor = 'var(--border-color)'; };
          div.onclick = () => { loadTab('inquiries'); selectInquiry(m.id); };

          const dateStr = new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
          const statusBadge = m.status === 'unread' ? '<span style="color:var(--color-error); font-weight:700;">●</span>' : '';

          div.innerHTML = `
            <div>
              <div style="font-weight:700; font-size:13.5px; display:flex; align-items:center; gap:8px;">${statusBadge}${m.name}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Interest: <span style="color:var(--color-accent); font-weight:600;">${m.projectType}</span></div>
            </div>
            <div style="font-size:11px; color:var(--text-muted);">${dateStr}</div>
          `;
          inquiriesContainer.appendChild(div);
        });
      }

      // 2. Fetch Active Chats
      const resChats = await fetch('/api/admin/chats');
      const chats = await resChats.json();

      chatsContainer.innerHTML = '';
      const activeSessions = chats.filter(c => c.status === 'active');
      if (activeSessions.length === 0) {
        chatsContainer.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center; font-size:13px;">No active chat sessions right now.</div>';
      } else {
        activeSessions.slice(0, 4).forEach(c => {
          const div = document.createElement('div');
          div.style.background = 'var(--bg-primary)';
          div.style.border = '1px solid var(--border-color)';
          div.style.padding = '14px 18px';
          div.style.borderRadius = '8px';
          div.style.cursor = 'pointer';
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          div.style.transition = 'all 0.2s';

          div.onmouseover = () => { div.style.borderColor = 'var(--color-info)'; };
          div.onmouseout = () => { div.style.borderColor = 'var(--border-color)'; };
          div.onclick = () => { loadTab('livechat'); selectChat(c.id); };

          const timeStr = new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          div.innerHTML = `
            <div>
              <div style="font-weight:700; font-size:13.5px;">${c.name}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${c.email || 'No email provided'}</div>
            </div>
            <span style="font-size:11px; color:var(--color-success); font-weight:600; display:flex; align-items:center; gap:5px;">
              <span class="status-pulse" style="width:6px; height:6px;"></span>
              Active (${timeStr})
            </span>
          `;
          chatsContainer.appendChild(div);
        });
      }
    } catch (err) {
      console.error('Failed to populate overview panels:', err);
    }
  }


  // ==========================================
  // 4. TAB LOGIC: INBOX (INQUIRIES)
  // ==========================================
  const searchInput = document.getElementById('inquiry-search');
  const filterSelect = document.getElementById('inquiry-filter-status');
  const inquiryListContainer = document.getElementById('inquiry-mailbox-list');
  const inquiryDetailPane = document.getElementById('inquiry-detail-pane');
  const inquiryDetailContent = document.getElementById('inquiry-detail-content');
  
  // Filter search event listeners
  searchInput.addEventListener('input', renderInquiryList);
  filterSelect.addEventListener('change', renderInquiryList);

  async function fetchInquiries() {
    try {
      const response = await fetch('/api/admin/messages');
      if (response.ok) {
        inquiries = await response.json();
        renderInquiryList();
        
        // Retain selection if applicable
        if (selectedInquiryId) {
          const exists = inquiries.some(m => m.id === selectedInquiryId);
          if (exists) selectInquiry(selectedInquiryId);
          else resetInquiryViewer();
        }
      }
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
    }
  }

  function renderInquiryList() {
    const searchVal = searchInput.value.toLowerCase().trim();
    const statusVal = filterSelect.value;

    inquiryListContainer.innerHTML = '';

    // Filter list
    const filtered = inquiries.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchVal) ||
                            m.email.toLowerCase().includes(searchVal) ||
                            (m.phone && m.phone.toLowerCase().includes(searchVal)) ||
                            m.message.toLowerCase().includes(searchVal);
      
      const matchesStatus = statusVal === 'all' || m.status === statusVal;

      return matchesSearch && matchesStatus;
    });

    if (filtered.length === 0) {
      inquiryListContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:var(--text-muted); font-size:13px;">No inquiries match filters.</div>';
      return;
    }

    filtered.forEach(m => {
      const dateStr = new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
      const activeClass = m.id === selectedInquiryId ? 'active' : '';
      const unreadClass = m.status === 'unread' ? 'unread' : '';
      const initial = m.name ? m.name.charAt(0).toUpperCase() : 'M';
      
      let statusPill = `<span class="inbox-status-pill read">Read</span>`;
      if (m.status === 'unread') {
        statusPill = `<span class="inbox-status-pill unread">Unread</span>`;
      } else if (m.status === 'replied') {
        statusPill = `<span class="inbox-status-pill replied">Replied</span>`;
      }

      const row = document.createElement('div');
      row.className = `inquiry-row ${activeClass} ${unreadClass}`;
      row.dataset.id = m.id;
      row.innerHTML = `
        <div class="inbox-avatar">${initial}</div>
        <div class="inbox-content">
          <div class="inbox-row-header">
            <span class="inbox-sender-name">${escapeHtml(m.name)}</span>
            <span class="inbox-date">${dateStr}</span>
          </div>
          <div class="inbox-project-line">
            <span class="inbox-project-tag">${escapeHtml(m.projectType)}</span>
            ${statusPill}
          </div>
          <div class="inbox-snippet">${escapeHtml(m.message)}</div>
        </div>
      `;

      row.onclick = () => selectInquiry(m.id);
      inquiryListContainer.appendChild(row);
    });
  }

  async function selectInquiry(id) {
    selectedInquiryId = id;
    
    // Highlight list row
    document.querySelectorAll('.inquiry-row').forEach(row => {
      row.classList.remove('active');
      if (row.dataset.id === id) {
        row.classList.add('active');
        row.classList.remove('unread'); // Remove unread class immediately
      }
    });

    try {
      // Get full details (also triggers status updated to "read" if unread)
      const response = await fetch(`/api/admin/messages/${id}`);
      if (response.ok) {
        const msg = await response.json();
        
        // Update stats badge & list item count if read state changed
        const originalIndex = inquiries.findIndex(m => m.id === id);
        if (originalIndex !== -1 && inquiries[originalIndex].status === 'unread') {
          inquiries[originalIndex].status = 'read';
          fetchStats();
        }

        // Show viewer content
        const emptyState = document.querySelector('#inquiry-detail-pane .detail-empty-state');
        if (emptyState) emptyState.style.display = 'none';
        inquiryDetailContent.style.display = 'flex';

        // Avatar & Header fields
        const initial = msg.name ? msg.name.charAt(0).toUpperCase() : 'M';
        document.getElementById('inquiry-avatar-circle').innerText = initial;
        document.getElementById('view-inquiry-name').innerText = msg.name;
        document.getElementById('view-inquiry-email').innerText = msg.email;
        document.getElementById('view-inquiry-phone').innerText = msg.phone || 'No phone provided';
        document.getElementById('view-inquiry-project').innerText = msg.projectType || 'General Enquiry';
        
        // Status badge
        const badge = document.getElementById('view-inquiry-status-badge');
        badge.className = `status-tag ${msg.status}`;
        badge.innerText = msg.status;

        // Date pill
        const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const datePill = document.getElementById('view-inquiry-date-pill');
        if (datePill) datePill.innerText = dateStr;

        // Populate WhatsApp Thread
        const thread = document.getElementById('inquiry-messages-thread');
        thread.innerHTML = '';

        // Initial Client Inquiry Bubble
        const reqTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clientBubble = document.createElement('div');
        clientBubble.className = 'wa-bubble-row user incoming';
        clientBubble.innerHTML = `
          <div class="wa-bubble">
            <div class="wa-sender-tag">${escapeHtml(msg.name)}</div>
            <div>${escapeHtml(msg.message).replace(/\n/g, '<br>')}</div>
            <div class="wa-bubble-footer">${reqTime}</div>
          </div>
        `;
        thread.appendChild(clientBubble);

        // Render replies timeline as WhatsApp outgoing bubbles
        if (msg.replies && msg.replies.length > 0) {
          msg.replies.forEach(rep => {
            appendInquiryReplyBubble(rep);
          });
        }

        // Scroll stream container to bottom
        const streamContainer = document.getElementById('inquiry-stream-container');
        if (streamContainer) streamContainer.scrollTop = streamContainer.scrollHeight;

        // Reset reply input
        const replyInput = document.getElementById('reply-text-input');
        replyInput.value = '';
        replyInput.placeholder = `Type an instant reply to ${msg.name}... (press Enter to send)`;
      }
    } catch (err) {
      console.error('Failed to load inquiry details:', err);
    }
  }

  function appendInquiryReplyBubble(rep) {
    const thread = document.getElementById('inquiry-messages-thread');
    if (!thread) return;
    const timeStr = rep.sentAt ? new Date(rep.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const replyBubble = document.createElement('div');
    replyBubble.className = 'wa-bubble-row admin outgoing';
    replyBubble.innerHTML = `
      <div class="wa-bubble">
        <div class="wa-sender-tag">Engineering Support</div>
        <div>${escapeHtml(rep.message || rep.reply_text || '').replace(/\n/g, '<br>')}</div>
        <div class="wa-bubble-footer">
          <span>${timeStr}</span>
          ${doubleCheckIcon}
        </div>
      </div>
    `;
    thread.appendChild(replyBubble);
    const streamContainer = document.getElementById('inquiry-stream-container');
    if (streamContainer) streamContainer.scrollTop = streamContainer.scrollHeight;
  }

  function resetInquiryViewer() {
    selectedInquiryId = null;
    const emptyState = document.querySelector('#inquiry-detail-pane .detail-empty-state');
    if (emptyState) emptyState.style.display = 'flex';
    inquiryDetailContent.style.display = 'none';
  }

  // Reply Submit Action
  const sendReplyBtn = document.getElementById('send-reply-submit');
  const replyInputText = document.getElementById('reply-text-input');

  async function submitInquiryReply() {
    const text = replyInputText.value.trim();
    if (text === '' || !selectedInquiryId) return;

    sendReplyBtn.disabled = true;

    try {
      const response = await fetch(`/api/admin/messages/${selectedInquiryId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText: text })
      });

      if (response.ok) {
        const resData = await response.json();
        sendReplyBtn.disabled = false;
        replyInputText.value = '';
        
        // Append bubble locally & refresh list status
        if (resData.reply) appendInquiryReplyBubble(resData.reply);
        fetchInquiries();
        fetchStats();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to send reply.');
        sendReplyBtn.disabled = false;
      }
    } catch (err) {
      alert('Error sending reply: server connection failed.');
      sendReplyBtn.disabled = false;
    }
  }

  sendReplyBtn.addEventListener('click', submitInquiryReply);
  if (replyInputText) {
    replyInputText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitInquiryReply();
      }
    });
  }

  // Delete Action
  const deleteBtn = document.getElementById('delete-inquiry-btn');
  deleteBtn.addEventListener('click', async () => {
    if (!selectedInquiryId) return;

    if (confirm('Are you sure you want to permanently delete this project inquiry?')) {
      try {
        const response = await fetch(`/api/admin/messages/${selectedInquiryId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          resetInquiryViewer();
          fetchInquiries();
          fetchStats();
        } else {
          alert('Failed to delete inquiry.');
        }
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  });


  // ==========================================
  // 5. TAB LOGIC: LIVE CHAT
  // ==========================================
  const chatSessionsList = document.getElementById('chat-sessions-list');
  const chatSearchInput = document.getElementById('chat-search');
  const chatViewerPane = document.getElementById('chat-viewer-pane');
  const chatActiveBox = document.getElementById('chat-active-box');
  const chatMessagesContainer = document.getElementById('chat-viewer-messages');
  const chatOpInput = document.getElementById('chat-operator-input');
  const chatOpSendBtn = document.getElementById('chat-operator-send');
  const closeChatSessionBtn = document.getElementById('close-chat-session-btn');

  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', renderChatSessions);
  }

  async function refreshChatList() {
    try {
      const response = await fetch('/api/admin/chats');
      if (response.ok) {
        chatSessions = await response.json();
        renderChatSessions();
        
        if (selectedChatId) {
          const activeSession = chatSessions.find(c => c.id === selectedChatId);
          if (activeSession) {
            document.getElementById('active-chat-visitor-name').innerText = activeSession.name;
            
            if (activeSession.status === 'closed') {
              chatOpInput.disabled = true;
              chatOpSendBtn.disabled = true;
            } else {
              chatOpInput.disabled = false;
              chatOpSendBtn.disabled = false;
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  }

  function renderChatSessions() {
    chatSessionsList.innerHTML = '';
    const searchVal = chatSearchInput ? chatSearchInput.value.toLowerCase().trim() : '';

    const filtered = chatSessions.filter(c => {
      return c.name.toLowerCase().includes(searchVal) ||
             (c.email && c.email.toLowerCase().includes(searchVal));
    });
    
    if (filtered.length === 0) {
      chatSessionsList.innerHTML = '<div style="padding:40px 20px; text-align:center; color:var(--text-muted); font-size:13px;">No chat sessions available.</div>';
      return;
    }

    filtered.forEach(c => {
      const activeClass = c.id === selectedChatId ? 'active' : '';
      const date = new Date(c.lastMessageAt);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const initial = c.name ? c.name.charAt(0).toUpperCase() : 'U';
      const statusBadge = c.status === 'active' 
        ? `<span class="chat-status-badge active"><span class="dot"></span>Active</span>` 
        : `<span class="chat-status-badge closed">Closed</span>`;
      
      const row = document.createElement('div');
      row.className = `chat-session-row ${activeClass}`;
      row.dataset.id = c.id;
      row.innerHTML = `
        <div class="chat-session-avatar">${initial}</div>
        <div class="chat-session-content">
          <div class="chat-session-header">
            <span class="chat-session-name">${escapeHtml(c.name)}</span>
            <span class="chat-session-time">${timeStr}</span>
          </div>
          <div class="chat-session-sub">
            <span class="chat-session-email">${escapeHtml(c.email || 'No Email Provided')}</span>
            ${statusBadge}
          </div>
        </div>
      `;
      row.onclick = () => selectChat(c.id);
      chatSessionsList.appendChild(row);
    });
  }

  async function selectChat(chatId) {
    selectedChatId = chatId;

    // Join room in socket
    setupSocket();
    socket.emit('joinChat', { chatId: chatId });

    // Highlight active list row
    document.querySelectorAll('.chat-session-row').forEach(row => {
      row.classList.remove('active');
      if (row.dataset.id === chatId) row.classList.add('active');
    });

    try {
      const chat = chatSessions.find(c => c.id === chatId);
      if (!chat) return;

      const emptyState = document.querySelector('#chat-viewer-pane .chat-empty-state');
      if (emptyState) emptyState.style.display = 'none';
      chatActiveBox.style.display = 'flex';

      // Header info & Avatar
      const initial = chat.name ? chat.name.charAt(0).toUpperCase() : 'U';
      document.getElementById('active-chat-avatar').innerText = initial;
      document.getElementById('active-chat-visitor-name').innerText = chat.name;
      document.getElementById('active-chat-visitor-email').innerText = (chat.email ? chat.email + ' · ' : '') + 'Online · Ready to chat';

      // WhatsApp Direct Link
      const waText = encodeURIComponent(`Hello ${chat.name}, following up on your live chat session with Maa Engineering Limited.`);
      const waBtn = document.getElementById('wa-direct-chat-btn');
      if (waBtn) waBtn.href = `https://wa.me/${targetWaNumber}?text=${waText}`;

      if (chat.status === 'closed') {
        chatOpInput.disabled = true;
        chatOpSendBtn.disabled = true;
        closeChatSessionBtn.style.display = 'none';
      } else {
        chatOpInput.disabled = false;
        chatOpSendBtn.disabled = false;
        closeChatSessionBtn.style.display = 'block';
      }

      // Fetch messages history
      const response = await fetch(`/api/admin/chats/${chatId}/messages`);
      if (response.ok) {
        const messages = await response.json();
        chatMessagesContainer.innerHTML = '';
        
        messages.forEach(m => {
          appendChatMsg(m.sender, m.text, m.timestamp);
        });
        scrollChatThread();
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    }
  }

  function appendChatMsg(sender, text, timestamp) {
    const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isUser = sender === 'user';
    const msgDiv = document.createElement('div');
    msgDiv.className = `wa-bubble-row ${isUser ? 'user incoming' : 'admin outgoing'}`;

    if (isUser) {
      const activeChat = chatSessions.find(c => c.id === selectedChatId);
      const visitorName = (activeChat && activeChat.name) ? activeChat.name : 'Client';
      msgDiv.innerHTML = `
        <div class="wa-bubble">
          <div class="wa-sender-tag">${escapeHtml(visitorName)}</div>
          <div>${escapeHtml(text).replace(/\n/g, '<br>')}</div>
          <div class="wa-bubble-footer">${timeStr}</div>
        </div>
      `;
    } else {
      msgDiv.innerHTML = `
        <div class="wa-bubble">
          <div class="wa-sender-tag">Operator</div>
          <div>${escapeHtml(text).replace(/\n/g, '<br>')}</div>
          <div class="wa-bubble-footer">
            <span>${timeStr}</span>
            ${doubleCheckIcon}
          </div>
        </div>
      `;
    }

    chatMessagesContainer.appendChild(msgDiv);
    scrollChatThread();
  }

  function appendChatSystemMsg(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `op-msg system`;
    msgDiv.innerText = text;
    chatMessagesContainer.appendChild(msgDiv);
    scrollChatThread();
  }

  function scrollChatThread() {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Operator chat composer actions
  function sendOperatorMessage() {
    const text = chatOpInput.value.trim();
    if (text === '' || !selectedChatId) return;

    setupSocket();
    
    socket.emit('sendMessage', {
      chatId: selectedChatId,
      sender: 'admin',
      text: text
    });

    chatOpInput.value = '';
    
    if (isTyping) {
      isTyping = false;
      socket.emit('stopTyping', { chatId: selectedChatId, sender: 'admin' });
      clearTimeout(typingTimeout);
    }
  }

  // Operator typing triggers
  function handleOpTyping() {
    if (!socket || !selectedChatId) return;

    if (!isTyping) {
      isTyping = true;
      socket.emit('typing', { chatId: selectedChatId, sender: 'admin' });
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit('stopTyping', { chatId: selectedChatId, sender: 'admin' });
    }, 2000);
  }

  chatOpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendOperatorMessage();
    } else {
      handleOpTyping();
    }
  });

  chatOpSendBtn.addEventListener('click', sendOperatorMessage);

  // Close Live Chat Session
  closeChatSessionBtn.addEventListener('click', async () => {
    if (!selectedChatId) return;

    if (confirm('Are you sure you want to end this live chat session?')) {
      try {
        const response = await fetch(`/api/admin/chats/${selectedChatId}/close`, {
          method: 'POST'
        });

        if (response.ok) {
          appendChatSystemMsg('The session has been closed.');
          chatOpInput.disabled = true;
          chatOpSendBtn.disabled = true;
          closeChatSessionBtn.style.display = 'none';
          refreshChatList();
        }
      } catch (err) {
        console.error('Failed to close chat session:', err);
      }
    }
  });


  // ==========================================
  // 6. TAB LOGIC: SETTINGS
  // ==========================================
  const pwForm = document.getElementById('password-settings-form');
  const waForm = document.getElementById('whatsapp-settings-form');
  const smtpForm = document.getElementById('smtp-settings-form');
  const smtpCheckbox = document.getElementById('settings-smtp-enable');
  const smtpFields = document.getElementById('smtp-fields');

  // Trigger SMTP field opacity based on enable checkbox
  if (smtpCheckbox && smtpFields) {
    smtpCheckbox.addEventListener('change', () => {
      if (smtpCheckbox.checked) {
        smtpFields.style.opacity = '1';
        smtpFields.style.pointerEvents = 'auto';
      } else {
        smtpFields.style.opacity = '0.5';
        smtpFields.style.pointerEvents = 'none';
      }
    });
  }

  async function fetchSettings() {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const settings = await response.json();
        
        // Populate inputs
        const waInput = document.getElementById('settings-wa-number');
        if (waInput) waInput.value = settings.whatsappNumber;

        if (document.getElementById('settings-smtp-host')) document.getElementById('settings-smtp-host').value = settings.smtpHost || '';
        if (document.getElementById('settings-smtp-port')) document.getElementById('settings-smtp-port').value = settings.smtpPort || '';
        if (document.getElementById('settings-smtp-user')) document.getElementById('settings-smtp-user').value = settings.smtpUser || '';
        if (document.getElementById('settings-smtp-pass')) document.getElementById('settings-smtp-pass').value = settings.smtpPass || '';
        if (document.getElementById('settings-sender-email')) document.getElementById('settings-sender-email').value = settings.senderEmail || '';
        
        if (smtpCheckbox) {
          smtpCheckbox.checked = settings.smtpEnabled;
          smtpCheckbox.dispatchEvent(new Event('change'));
        }

        // Update Reply Composer hints
        updateComposerGatewayHints(settings.smtpEnabled);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  function updateComposerGatewayHints(enabled) {
    const dot = document.getElementById('smtp-composer-dot');
    const text = document.getElementById('smtp-composer-text');
    if (!dot || !text) return;
    if (enabled) {
      dot.className = 'smtp-indicator-dot active';
      text.innerText = 'SMTP enabled (Email gateway live)';
    } else {
      dot.className = 'smtp-indicator-dot';
      text.innerText = 'SMTP disabled (Simulation mode active)';
    }
  }

  // Update Password Submit
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('settings-curr-pass').value;
    const newPassword = document.getElementById('settings-new-pass').value;
    const confirmPassword = document.getElementById('settings-confirm-pass').value;
    const feedback = document.getElementById('password-feedback');

    feedback.className = 'settings-feedback';
    feedback.innerText = '';

    if (newPassword !== confirmPassword) {
      feedback.className = 'settings-feedback error';
      feedback.innerText = 'New passwords do not match.';
      return;
    }

    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (response.ok) {
        feedback.className = 'settings-feedback success';
        feedback.innerText = 'Password updated successfully.';
        pwForm.reset();
      } else {
        const data = await response.json();
        feedback.className = 'settings-feedback error';
        feedback.innerText = data.error || 'Password update failed.';
      }
    } catch (err) {
      feedback.className = 'settings-feedback error';
      feedback.innerText = 'Server connection failed.';
    }
  });

  // Update WhatsApp Settings Submit
  waForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const whatsappNumber = document.getElementById('settings-wa-number').value.trim();
    const feedback = document.getElementById('whatsapp-feedback');

    feedback.className = 'settings-feedback';
    feedback.innerText = '';

    if (!/^\d+$/.test(whatsappNumber)) {
      feedback.className = 'settings-feedback error';
      feedback.innerText = 'Please enter numeric digits only (no spaces, plus signs, or symbols).';
      return;
    }

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappNumber })
      });

      if (response.ok) {
        feedback.className = 'settings-feedback success';
        feedback.innerText = 'WhatsApp settings saved.';
        fetchSettings();
      } else {
        feedback.className = 'settings-feedback error';
        feedback.innerText = 'Failed to save settings.';
      }
    } catch (err) {
      feedback.className = 'settings-feedback error';
      feedback.innerText = 'Server connection failed.';
    }
  });

  // Update SMTP Settings Submit
  if (smtpForm) {
    smtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const smtpEnabled = smtpCheckbox ? smtpCheckbox.checked : false;
      const smtpHost = document.getElementById('settings-smtp-host') ? document.getElementById('settings-smtp-host').value.trim() : '';
      const smtpPort = document.getElementById('settings-smtp-port') ? document.getElementById('settings-smtp-port').value.trim() : '';
      const smtpUser = document.getElementById('settings-smtp-user') ? document.getElementById('settings-smtp-user').value.trim() : '';
      const smtpPass = document.getElementById('settings-smtp-pass') ? document.getElementById('settings-smtp-pass').value.trim() : '';
      const senderEmail = document.getElementById('settings-sender-email') ? document.getElementById('settings-sender-email').value.trim() : '';
      const feedback = document.getElementById('smtp-feedback');

      if (feedback) {
        feedback.className = 'settings-feedback';
        feedback.innerText = '';
      }

      try {
        const response = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smtpEnabled,
            smtpHost,
            smtpPort,
            smtpUser,
            smtpPass,
            senderEmail
          })
        });

        if (response.ok) {
          if (feedback) {
            feedback.className = 'settings-feedback success';
            feedback.innerText = 'SMTP settings updated successfully.';
          }
          fetchSettings();
        } else {
          if (feedback) {
            feedback.className = 'settings-feedback error';
            feedback.innerText = 'Failed to update SMTP settings.';
          }
        }
      } catch (err) {
        if (feedback) {
          feedback.className = 'settings-feedback error';
          feedback.innerText = 'Server connection failed.';
        }
      }
    });
  }


  // RUN ON START
  checkAuth();
});
