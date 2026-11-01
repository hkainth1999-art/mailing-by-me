// State
let currentAddress = '';
let currentDomain = '';
let availableDomains = [];
let messages = [];
let selectedMessage = null;
let ws = null;
let wsHeartbeat = null;

// DOM Elements
const currentAddressText = document.getElementById('currentAddressText');
const copyAddressBtn = document.getElementById('copyAddressBtn');
const copyText = document.getElementById('copyText');
const domainSelect = document.getElementById('domainSelect');
const randomMailBtn = document.getElementById('randomMailBtn');
const wsStatusBadge = document.getElementById('wsStatusBadge');
const wsStatusText = document.getElementById('wsStatusText');
const customAddressForm = document.getElementById('customAddressForm');
const customAddressInput = document.getElementById('customAddressInput');

const discordBanner = document.getElementById('discordBanner');
const discordSubject = document.getElementById('discordSubject');
const discordCodeBox = document.getElementById('discordCodeBox');
const discordCodeText = document.getElementById('discordCodeText');
const copyDiscordCodeBtn = document.getElementById('copyDiscordCodeBtn');
const discordVerifyLink = document.getElementById('discordVerifyLink');

const messagesList = document.getElementById('messagesList');
const emptyFeedState = document.getElementById('emptyFeedState');
const messageCountBadge = document.getElementById('messageCountBadge');
const refreshFeedBtn = document.getElementById('refreshFeedBtn');
const clearInboxBtn = document.getElementById('clearInboxBtn');

const noMessageSelected = document.getElementById('noMessageSelected');
const activeMessageViewer = document.getElementById('activeMessageViewer');
const viewSubject = document.getElementById('viewSubject');
const viewFrom = document.getElementById('viewFrom');
const viewDate = document.getElementById('viewDate');
const deleteMessageBtn = document.getElementById('deleteMessageBtn');
const attachmentsBar = document.getElementById('attachmentsBar');
const attachmentsList = document.getElementById('attachmentsList');

const htmlIframe = document.getElementById('htmlIframe');
const paneHtml = document.getElementById('paneHtml');
const paneText = document.getElementById('paneText');
const paneHeaders = document.getElementById('paneHeaders');
const paneRaw = document.getElementById('paneRaw');
const viewTabs = document.querySelectorAll('.view-tab');

// Generate random string
function randomLocalPart(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// 1. Initialize Domains
async function initDomains() {
  try {
    const res = await fetch('/api/domains');
    const data = await res.json();
    availableDomains = data.domains || ['rizzcord.site'];
    domainSelect.innerHTML = availableDomains
      .map((d) => `<option value="${d}">${d}</option>`)
      .join('');
    currentDomain = availableDomains[0];
  } catch (err) {
    availableDomains = ['rizzcord.site'];
    currentDomain = 'rizzcord.site';
  }

  // Check URL hash for initial address
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && hash.includes('@')) {
    setAddress(hash);
  } else {
    // Generate fresh mailbox
    setAddress(`${randomLocalPart()}@${currentDomain}`);
  }
}

// Set active address
function setAddress(addr) {
  currentAddress = addr.toLowerCase().trim();
  window.location.hash = currentAddress;
  currentAddressText.textContent = currentAddress;
  customAddressInput.value = currentAddress;

  const parts = currentAddress.split('@');
  if (parts[1] && availableDomains.includes(parts[1])) {
    domainSelect.value = parts[1];
    currentDomain = parts[1];
  }

  selectedMessage = null;
  loadMessages();
  checkDiscordVerification();
  connectWebSocket();
}

// Load messages for current address
async function loadMessages() {
  if (!currentAddress) return;
  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(currentAddress)}`);
    const data = await res.json();
    messages = data.messages || [];
    renderMessagesList();
    if (messages.length > 0 && !selectedMessage) {
      loadMessageDetail(messages[0].id);
    }
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

// Render message list
function renderMessagesList() {
  messageCountBadge.textContent = messages.length;

  if (messages.length === 0) {
    emptyFeedState.classList.remove('hidden');
    messagesList.innerHTML = '';
    messagesList.appendChild(emptyFeedState);
    noMessageSelected.classList.remove('hidden');
    activeMessageViewer.classList.add('hidden');
    return;
  }

  emptyFeedState.classList.add('hidden');
  messagesList.innerHTML = '';

  messages.forEach((msg) => {
    const isSelected = selectedMessage && selectedMessage.id === msg.id;
    const item = document.createElement('div');
    item.className = `p-3.5 transition cursor-pointer select-none ${
      isSelected ? 'bg-purple-950/40 border-l-4 border-purple-500' : 'hover:bg-gray-900/60'
    }`;

    const dateStr = new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs truncate font-medium ${msg.is_read ? 'text-gray-400' : 'text-white font-bold'}">
          ${escapeHtml(msg.from_name || msg.from_address || 'Unknown')}
        </span>
        <span class="text-[10px] text-gray-500 font-mono flex-shrink-0 ml-2">${dateStr}</span>
      </div>
      <h4 class="text-xs truncate ${msg.is_read ? 'text-gray-300' : 'text-purple-300 font-bold'}">
        ${escapeHtml(msg.subject || '(No Subject)')}
      </h4>
      <p class="text-[11px] text-gray-500 truncate mt-1">
        ${escapeHtml(msg.snippet || 'No text content')}
      </p>
    `;

    item.onclick = () => loadMessageDetail(msg.id);
    messagesList.appendChild(item);
  });
}

// Load single message detail
async function loadMessageDetail(id) {
  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(currentAddress)}/${id}`);
    const data = await res.json();
    if (data.message) {
      selectedMessage = data.message;
      renderMessageViewer(selectedMessage);
      renderMessagesList(); // update read state
    }
  } catch (err) {
    console.error('Failed to load message detail:', err);
  }
}

// Render message viewer
function renderMessageViewer(msg) {
  noMessageSelected.classList.add('hidden');
  activeMessageViewer.classList.remove('hidden');

  viewSubject.textContent = msg.subject || '(No Subject)';
  viewFrom.textContent = msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address;
  viewDate.textContent = new Date(msg.received_at).toLocaleString();

  // Attachments
  if (msg.attachments && msg.attachments.length > 0) {
    attachmentsBar.classList.remove('hidden');
    attachmentsList.innerHTML = msg.attachments
      .map(
        (att) => `
        <a href="data:${att.contentType};base64,${att.contentBase64}" download="${escapeHtml(att.filename)}"
           class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-purple-300 text-xs border border-gray-700 transition">
          <span>📎</span> <span>${escapeHtml(att.filename)}</span>
          <span class="text-[10px] text-gray-400">(${formatBytes(att.size)})</span>
        </a>
      `
      )
      .join('');
  } else {
    attachmentsBar.classList.add('hidden');
    attachmentsList.innerHTML = '';
  }

  // Panes
  // HTML (via blob in sandboxed iframe)
  const htmlContent = msg.html_body || `<pre style="font-family: monospace; white-space: pre-wrap; color: #222;">${escapeHtml(msg.text_body || 'Empty message')}</pre>`;
  htmlIframe.srcdoc = htmlContent;

  // Text
  paneText.textContent = msg.text_body || 'No plain text version available.';

  // Headers
  paneHeaders.textContent = JSON.stringify(msg.headers || {}, null, 2);

  // Raw
  paneRaw.textContent = msg.raw_mime || 'No raw source stored.';

  // Default to HTML tab
  switchTab('html');
}

// Tab Switching
function switchTab(tabKey) {
  viewTabs.forEach((tab) => {
    if (tab.dataset.tab === tabKey) {
      tab.classList.add('text-purple-400', 'border-b-2', 'border-purple-500');
      tab.classList.remove('text-gray-400');
    } else {
      tab.classList.remove('text-purple-400', 'border-b-2', 'border-purple-500');
      tab.classList.add('text-gray-400');
    }
  });

  paneHtml.classList.toggle('hidden', tabKey !== 'html');
  paneText.classList.toggle('hidden', tabKey !== 'text');
  paneHeaders.classList.toggle('hidden', tabKey !== 'headers');
  paneRaw.classList.toggle('hidden', tabKey !== 'raw');
}

viewTabs.forEach((tab) => {
  tab.onclick = () => switchTab(tab.dataset.tab);
});

// Check Discord Verification Code
async function checkDiscordVerification() {
  if (!currentAddress) return;
  try {
    const res = await fetch(`/api/discord/${encodeURIComponent(currentAddress)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.found) {
        showDiscordBanner(data);
      } else {
        discordBanner.classList.add('hidden');
      }
    } else {
      discordBanner.classList.add('hidden');
    }
  } catch {
    discordBanner.classList.add('hidden');
  }
}

function showDiscordBanner(data) {
  discordBanner.classList.remove('hidden');
  discordSubject.textContent = data.subject || 'Your Discord verification email has arrived!';

  if (data.discord_code) {
    discordCodeBox.classList.remove('hidden');
    discordCodeBox.classList.add('flex');
    discordCodeText.textContent = data.discord_code;
    copyDiscordCodeBtn.onclick = () => {
      navigator.clipboard.writeText(data.discord_code);
      copyDiscordCodeBtn.textContent = 'Copied!';
      setTimeout(() => (copyDiscordCodeBtn.textContent = 'Copy Code'), 2000);
    };
  } else {
    discordCodeBox.classList.add('hidden');
    discordCodeBox.classList.remove('flex');
  }

  if (data.discord_url) {
    discordVerifyLink.classList.remove('hidden');
    discordVerifyLink.classList.add('inline-flex');
    discordVerifyLink.href = data.discord_url;
  } else {
    discordVerifyLink.classList.add('hidden');
    discordVerifyLink.classList.remove('inline-flex');
  }
}

// WebSocket Real-time Connection
function connectWebSocket() {
  if (ws) {
    ws.close();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?address=${encodeURIComponent(currentAddress)}`;

  setWsStatus('connecting');

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setWsStatus('connected');
    if (wsHeartbeat) clearInterval(wsHeartbeat);
    wsHeartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 25000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'new_message') {
        const newMsg = data.message;
        // Check if message belongs to current inbox
        if (!newMsg.inbox_address || newMsg.inbox_address.toLowerCase() === currentAddress.toLowerCase()) {
          // Prepend
          messages = [newMsg, ...messages.filter((m) => m.id !== newMsg.id)];
          renderMessagesList();
          loadMessageDetail(newMsg.id);

          // Flash notification
          if (newMsg.discord_code || newMsg.discord_url) {
            showDiscordBanner(newMsg);
          }
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  };

  ws.onclose = () => {
    setWsStatus('disconnected');
    setTimeout(() => {
      if (currentAddress) connectWebSocket();
    }, 3000);
  };

  ws.onerror = () => {
    setWsStatus('disconnected');
  };
}

function setWsStatus(status) {
  if (status === 'connected') {
    wsStatusBadge.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    wsStatusText.textContent = 'Live Connected';
  } else if (status === 'connecting') {
    wsStatusBadge.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    wsStatusText.textContent = 'Connecting...';
  } else {
    wsStatusBadge.className = 'flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20';
    wsStatusText.textContent = 'Disconnected';
  }
}

// Copy Address
copyAddressBtn.onclick = () => {
  navigator.clipboard.writeText(currentAddress);
  copyText.textContent = 'Copied!';
  setTimeout(() => (copyText.textContent = 'Copy'), 2000);
};

// Domain Change
domainSelect.onchange = () => {
  currentDomain = domainSelect.value;
  const localPart = currentAddress.split('@')[0] || randomLocalPart();
  setAddress(`${localPart}@${currentDomain}`);
};

// Random Button
randomMailBtn.onclick = () => {
  setAddress(`${randomLocalPart()}@${currentDomain}`);
};

// Custom Address Form
customAddressForm.onsubmit = (e) => {
  e.preventDefault();
  let query = customAddressInput.value.trim().toLowerCase();
  if (!query) return;
  if (!query.includes('@')) {
    query = `${query}@${currentDomain}`;
  }
  setAddress(query);
};

// Refresh Feed Button
refreshFeedBtn.onclick = () => {
  loadMessages();
  checkDiscordVerification();
};

// Clear Inbox Button
clearInboxBtn.onclick = async () => {
  if (confirm(`Delete all messages in ${currentAddress}?`)) {
    await fetch(`/api/inbox/${encodeURIComponent(currentAddress)}`, { method: 'DELETE' });
    messages = [];
    selectedMessage = null;
    renderMessagesList();
    discordBanner.classList.add('hidden');
  }
};

// Delete Single Message
deleteMessageBtn.onclick = async () => {
  if (!selectedMessage) return;
  if (confirm('Delete this email?')) {
    await fetch(`/api/messages/${encodeURIComponent(currentAddress)}/${selectedMessage.id}`, { method: 'DELETE' });
    messages = messages.filter((m) => m.id !== selectedMessage.id);
    selectedMessage = messages[0] || null;
    if (selectedMessage) {
      loadMessageDetail(selectedMessage.id);
    } else {
      renderMessagesList();
    }
  }
};

// Periodic Fallback Polling (every 5 seconds)
setInterval(() => {
  if (currentAddress) {
    loadMessages();
    checkDiscordVerification();
  }
}, 5000);

// Helper functions
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Boot
initDomains();

