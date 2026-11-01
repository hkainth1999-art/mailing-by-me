// ==============================================================================
// CYBER TEMP MAIL — CLIENT CONTROLLER & REAL-TIME ENGINE
// ==============================================================================

// Application State
let currentAddress = '';
let currentDomain = '';
let availableDomains = [];
let messages = [];
let selectedMessage = null;
let soundEnabled = localStorage.getItem('cyber_sound') !== 'false';
let adminToken = localStorage.getItem('cyber_admin_token') || null;
let ws = null;
let wsHeartbeat = null;
let recentMailboxes = JSON.parse(localStorage.getItem('cyber_recent_mailboxes') || '[]');

// Audio Synthesizer Chime (Web Audio API)
let audioCtx = null;
function playCyberChime() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    // Tone 1 (High tone)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Tone 2 (Harmonic finish)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// DOM Elements
const pasteInboxForm = document.getElementById('pasteInboxForm');
const pasteInboxInput = document.getElementById('pasteInboxInput');
const randomMailBtn = document.getElementById('randomMailBtn');
const openCreateCustomBtn = document.getElementById('openCreateCustomBtn');
const customCreateDrawer = document.getElementById('customCreateDrawer');
const customCreateForm = document.getElementById('customCreateForm');
const customUsernameInput = document.getElementById('customUsernameInput');
const customDomainSelect = document.getElementById('customDomainSelect');
const recentMailboxesList = document.getElementById('recentMailboxesList');

const activeAddressDisplay = document.getElementById('activeAddressDisplay');
const copyActiveAddressBtn = document.getElementById('copyActiveAddressBtn');
const copyBtnText = document.getElementById('copyBtnText');
const mainDomainSelect = document.getElementById('mainDomainSelect');
const refreshInboxBtn = document.getElementById('refreshInboxBtn');
const clearCurrentInboxBtn = document.getElementById('clearCurrentInboxBtn');
const openQrBtn = document.getElementById('openQrBtn');

const wsStatusBadge = document.getElementById('wsStatusBadge');
const wsStatusText = document.getElementById('wsStatusText');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const soundText = document.getElementById('soundText');

const discordBanner = document.getElementById('discordBanner');
const discordSubject = document.getElementById('discordSubject');
const discordCodeBox = document.getElementById('discordCodeBox');
const discordCodeText = document.getElementById('discordCodeText');
const copyDiscordCodeBtn = document.getElementById('copyDiscordCodeBtn');
const copyDiscordBtnText = document.getElementById('copyDiscordBtnText');
const discordVerifyLink = document.getElementById('discordVerifyLink');

const feedCountBadge = document.getElementById('feedCountBadge');
const feedSearchInput = document.getElementById('feedSearchInput');
const messagesList = document.getElementById('messagesList');
const emptyFeedState = document.getElementById('emptyFeedState');

const noMessageSelected = document.getElementById('noMessageSelected');
const activeMessageViewer = document.getElementById('activeMessageViewer');
const viewSubject = document.getElementById('viewSubject');
const viewFrom = document.getElementById('viewFrom');
const viewDate = document.getElementById('viewDate');
const downloadEmlBtn = document.getElementById('downloadEmlBtn');
const deleteMessageBtn = document.getElementById('deleteMessageBtn');
const attachmentsBar = document.getElementById('attachmentsBar');
const attachmentsList = document.getElementById('attachmentsList');
const htmlIframe = document.getElementById('htmlIframe');
const paneHtml = document.getElementById('paneHtml');
const paneText = document.getElementById('paneText');
const paneHeaders = document.getElementById('paneHeaders');
const paneRaw = document.getElementById('paneRaw');
const viewTabs = document.querySelectorAll('.view-tab');

// Modals
const openAdminBtn = document.getElementById('openAdminBtn');
const adminModal = document.getElementById('adminModal');
const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');
const adminLoginFormContainer = document.getElementById('adminLoginFormContainer');
const adminKeyVaultContainer = document.getElementById('adminKeyVaultContainer');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const adminLoginError = document.getElementById('adminLoginError');
const createApiKeyForm = document.getElementById('createApiKeyForm');
const newKeyNameInput = document.getElementById('newKeyNameInput');
const newKeyPermSelect = document.getElementById('newKeyPermSelect');
const newKeyAlert = document.getElementById('newKeyAlert');
const newKeyValueDisplay = document.getElementById('newKeyValueDisplay');
const copyNewKeyBtn = document.getElementById('copyNewKeyBtn');
const activeKeysList = document.getElementById('activeKeysList');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

const openApiTesterBtn = document.getElementById('openApiTesterBtn');
const apiTesterModal = document.getElementById('apiTesterModal');
const closeApiTesterBtn = document.getElementById('closeApiTesterBtn');
const testerEndpointSelect = document.getElementById('testerEndpointSelect');
const testerAddressInput = document.getElementById('testerAddressInput');
const testerApiKeyInput = document.getElementById('testerApiKeyInput');
const runApiTestBtn = document.getElementById('runApiTestBtn');
const copyCurlBtn = document.getElementById('copyCurlBtn');
const testerStatusCode = document.getElementById('testerStatusCode');
const testerLatency = document.getElementById('testerLatency');
const testerResponseBox = document.getElementById('testerResponseBox');

const qrModal = document.getElementById('qrModal');
const closeQrModalBtn = document.getElementById('closeQrModalBtn');
const qrCanvas = document.getElementById('qrCanvas');
const qrAddressText = document.getElementById('qrAddressText');

// Helper: Random string
function randomLocalPart(len = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let res = '';
  for (let i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

// 1. Initialize Domains & Mailbox
async function initApp() {
  updateSoundUI();

  try {
    const res = await fetch('/api/domains');
    const data = await res.json();
    availableDomains = data.domains || ['rizzcord.site'];
  } catch (err) {
    availableDomains = ['rizzcord.site'];
  }

  currentDomain = availableDomains[0] || 'rizzcord.site';

  // Populate Domain selects
  const domainOptions = availableDomains
    .map((d) => `<option value="${d}">${d}</option>`)
    .join('');
  mainDomainSelect.innerHTML = domainOptions;
  customDomainSelect.innerHTML = domainOptions;

  // Check initial address from URL hash
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && hash.includes('@')) {
    setAddress(hash);
  } else {
    // Generate sleek initial address
    setAddress(`cyber-${randomLocalPart(6)}@${currentDomain}`);
  }

  renderRecentMailboxes();
}

// Update Active Address
function setAddress(addr) {
  const clean = addr.toLowerCase().trim();
  if (!clean) return;

  currentAddress = clean;
  window.location.hash = currentAddress;
  activeAddressDisplay.textContent = currentAddress;
  pasteInboxInput.value = currentAddress;
  testerAddressInput.value = currentAddress;

  const parts = currentAddress.split('@');
  if (parts[1] && availableDomains.includes(parts[1])) {
    mainDomainSelect.value = parts[1];
    currentDomain = parts[1];
  }

  // Save to recent inboxes
  saveRecentMailbox(currentAddress);

  // Register in SQLite vault (persisted for 10 days)
  fetch('/api/inbox/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: currentAddress }),
  }).catch(() => {});

  // Reset viewer
  selectedMessage = null;
  noMessageSelected.classList.remove('hidden');
  activeMessageViewer.classList.add('hidden');

  // Load 10-day conserved messages
  loadMessages();
  checkDiscordVerification();

  // Connect WebSocket to live stream
  connectWebSocket();
}

// Save recent mailbox to history
function saveRecentMailbox(addr) {
  recentMailboxes = recentMailboxes.filter((a) => a !== addr);
  recentMailboxes.unshift(addr);
  if (recentMailboxes.length > 8) {
    recentMailboxes = recentMailboxes.slice(0, 8);
  }
  localStorage.setItem('cyber_recent_mailboxes', JSON.stringify(recentMailboxes));
  renderRecentMailboxes();
}

function renderRecentMailboxes() {
  if (!recentMailboxes.length) {
    recentMailboxesList.innerHTML = '<span class="text-[11px] font-mono text-gray-600">None yet</span>';
    return;
  }
  recentMailboxesList.innerHTML = recentMailboxes
    .map(
      (addr) => `
      <button class="recent-mailbox-chip neo-pill px-2.5 py-1 rounded-lg text-[11px] font-mono text-gray-300 hover:text-cyan-300 hover:border-cyan-500/30 transition flex items-center gap-1 ${
        addr === currentAddress ? 'border-cyan-500/40 text-cyan-300' : ''
      }" data-addr="${addr}">
        <span>📬</span>
        <span>${addr}</span>
      </button>
    `
    )
    .join('');

  document.querySelectorAll('.recent-mailbox-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      setAddress(btn.getAttribute('data-addr'));
    });
  });
}

// 2. Load Messages from 10-Day SQLite Vault
async function loadMessages() {
  if (!currentAddress) return;

  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(currentAddress)}`);
    const data = await res.json();
    messages = data.messages || [];
    renderFeed();
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

// Render Messages Feed
function renderFeed() {
  const searchTerm = (feedSearchInput.value || '').toLowerCase().trim();
  const filtered = messages.filter((m) => {
    if (!searchTerm) return true;
    return (
      (m.subject || '').toLowerCase().includes(searchTerm) ||
      (m.from_address || '').toLowerCase().includes(searchTerm) ||
      (m.from_name || '').toLowerCase().includes(searchTerm)
    );
  });

  feedCountBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    messagesList.innerHTML = '';
    emptyFeedState.classList.remove('hidden');
    return;
  }

  emptyFeedState.classList.add('hidden');
  messagesList.innerHTML = filtered
    .map((msg) => {
      const isSelected = selectedMessage && selectedMessage.id === msg.id;
      const formattedTime = new Date(msg.received_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const hasAttachments = Boolean(msg.has_attachments);
      const isDiscord = Boolean(msg.discord_code || msg.discord_url);

      return `
        <div class="message-card p-3 rounded-xl cursor-pointer transition neo-plate-hover ${
          isSelected ? 'neo-inset border-cyan-500/40' : 'bg-transparent'
        }" data-id="${msg.id}">
          <div class="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
            <span class="font-bold text-gray-200 truncate max-w-[180px]">${escapeHtml(msg.from_name || msg.from_address || 'Anonymous')}</span>
            <span>${formattedTime}</span>
          </div>
          <div class="text-xs font-semibold text-white truncate mb-1">
            ${escapeHtml(msg.subject || '(No Subject)')}
          </div>
          <div class="text-[11px] text-gray-500 font-mono truncate">
            ${escapeHtml(msg.snippet || '')}
          </div>
          <div class="flex items-center gap-1.5 mt-2">
            ${
              isDiscord
                ? `<span class="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">OTP: ${msg.discord_code || 'Link'}</span>`
                : ''
            }
            ${
              hasAttachments
                ? `<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">📎 Attach</span>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.message-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      viewMessage(id);
    });
  });
}

// 3. View Full Message Details
async function viewMessage(id) {
  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(currentAddress)}/${id}`);
    const data = await res.json();
    if (!data.message) return;

    selectedMessage = data.message;
    renderFeed(); // Update selection highlight

    noMessageSelected.classList.add('hidden');
    activeMessageViewer.classList.remove('hidden');

    viewSubject.textContent = selectedMessage.subject || '(No Subject)';
    viewFrom.textContent = selectedMessage.from_name
      ? `${selectedMessage.from_name} <${selectedMessage.from_address}>`
      : selectedMessage.from_address;
    viewDate.textContent = new Date(selectedMessage.received_at).toLocaleString();

    downloadEmlBtn.href = `/api/messages/${encodeURIComponent(currentAddress)}/${id}/download`;

    // Attachments
    if (selectedMessage.attachments && selectedMessage.attachments.length > 0) {
      attachmentsBar.classList.remove('hidden');
      attachmentsList.innerHTML = selectedMessage.attachments
        .map(
          (att) => `
        <span class="neo-inset px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-1.5">
          <span>📎</span>
          <span>${escapeHtml(att.filename || 'attachment')}</span>
          <span class="text-[10px] text-gray-500">(${Math.round((att.size || 0) / 1024)} KB)</span>
        </span>
      `
        )
        .join('');
    } else {
      attachmentsBar.classList.add('hidden');
    }

    // Populate Tab Contents
    const htmlContent = selectedMessage.html_body || `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(selectedMessage.text_body || 'No text content')}</pre>`;
    htmlIframe.srcdoc = htmlContent;

    paneText.textContent = selectedMessage.text_body || '(No text content)';
    paneHeaders.textContent = JSON.stringify(selectedMessage.headers || {}, null, 2);
    paneRaw.textContent = selectedMessage.raw_mime || '(Raw source unavailable)';

    switchTab('html');
  } catch (err) {
    console.error('Failed to view message:', err);
  }
}

// Tab Switcher
function switchTab(tabName) {
  viewTabs.forEach((tab) => {
    const isTarget = tab.getAttribute('data-tab') === tabName;
    if (isTarget) {
      tab.className = 'view-tab neo-pill px-3 py-1 rounded-lg text-xs font-mono text-cyan-400 font-bold border-cyan-500/40';
    } else {
      tab.className = 'view-tab neo-btn px-3 py-1 rounded-lg text-xs font-mono text-gray-400 hover:text-white';
    }
  });

  paneHtml.classList.add('hidden');
  paneText.classList.add('hidden');
  paneHeaders.classList.add('hidden');
  paneRaw.classList.add('hidden');

  if (tabName === 'html') paneHtml.classList.remove('hidden');
  if (tabName === 'text') paneText.classList.remove('hidden');
  if (tabName === 'headers') paneHeaders.classList.remove('hidden');
  if (tabName === 'raw') paneRaw.classList.remove('hidden');
}

viewTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    switchTab(tab.getAttribute('data-tab'));
  });
});

// 4. Discord Verification Extractor
async function checkDiscordVerification() {
  if (!currentAddress) return;
  try {
    const res = await fetch(`/api/discord/${encodeURIComponent(currentAddress)}`);
    const data = await res.json();

    if (data.found) {
      discordBanner.classList.remove('hidden');
      discordSubject.textContent = data.subject || 'Discord verification code detected';

      if (data.discord_code) {
        discordCodeBox.classList.remove('hidden');
        discordCodeText.textContent = data.discord_code;
      } else {
        discordCodeBox.classList.add('hidden');
      }

      if (data.discord_url) {
        discordVerifyLink.classList.remove('hidden');
        discordVerifyLink.href = data.discord_url;
      } else {
        discordVerifyLink.classList.add('hidden');
      }
    } else {
      discordBanner.classList.add('hidden');
    }
  } catch {
    discordBanner.classList.add('hidden');
  }
}

// 5. Real-Time WebSocket Connection
function connectWebSocket() {
  if (ws) {
    try {
      ws.close();
    } catch {}
  }
  clearInterval(wsHeartbeat);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/?address=${encodeURIComponent(currentAddress)}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsStatusBadge.className = 'neo-pill flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono text-emerald-400 border border-emerald-500/20';
      wsStatusText.textContent = 'MESH LIVE';

      wsHeartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_email') {
          playCyberChime();
          loadMessages();
          checkDiscordVerification();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      wsStatusBadge.className = 'neo-pill flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-mono text-yellow-400 border border-yellow-500/20';
      wsStatusText.textContent = 'RECONNECTING';
      setTimeout(connectWebSocket, 4000);
    };

    ws.onerror = () => {
      ws.close();
    };
  } catch {
    setTimeout(connectWebSocket, 5000);
  }
}

// 6. Action Handlers

// Paste & Open Form
pasteInboxForm.addEventListener('submit', (e) => {
  e.preventDefault();
  let inputVal = pasteInboxInput.value.trim();
  if (!inputVal) return;

  if (!inputVal.includes('@')) {
    inputVal = `${inputVal}@${currentDomain}`;
  }
  setAddress(inputVal);
});

// Random Mail Button
randomMailBtn.addEventListener('click', () => {
  const prefix = `cyber-${randomLocalPart(6)}`;
  setAddress(`${prefix}@${currentDomain}`);
});

// Custom Drawer Toggle & Creation
openCreateCustomBtn.addEventListener('click', () => {
  customCreateDrawer.classList.toggle('hidden');
});

customCreateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = customUsernameInput.value.trim().toLowerCase();
  const domain = customDomainSelect.value;
  if (!username) return;

  setAddress(`${username}@${domain}`);
  customUsernameInput.value = '';
  customCreateDrawer.classList.add('hidden');
});

// Domain Selector Change
mainDomainSelect.addEventListener('change', (e) => {
  currentDomain = e.target.value;
  const parts = currentAddress.split('@');
  const user = parts[0] || `cyber-${randomLocalPart(6)}`;
  setAddress(`${user}@${currentDomain}`);
});

// Copy Address
copyActiveAddressBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(currentAddress).then(() => {
    copyBtnText.textContent = 'Copied!';
    setTimeout(() => {
      copyBtnText.textContent = 'Copy';
    }, 2000);
  });
});

// Copy Discord OTP
copyDiscordCodeBtn.addEventListener('click', () => {
  const code = discordCodeText.textContent.trim();
  if (code && code !== '------') {
    navigator.clipboard.writeText(code).then(() => {
      copyDiscordBtnText.textContent = 'Copied!';
      setTimeout(() => {
        copyDiscordBtnText.textContent = 'Copy';
      }, 2000);
    });
  }
});

// Delete Message
deleteMessageBtn.addEventListener('click', async () => {
  if (!selectedMessage) return;
  if (!confirm('Permanently delete this email from the vault?')) return;

  try {
    await fetch(`/api/messages/${encodeURIComponent(currentAddress)}/${selectedMessage.id}`, {
      method: 'DELETE',
    });
    selectedMessage = null;
    noMessageSelected.classList.remove('hidden');
    activeMessageViewer.classList.add('hidden');
    loadMessages();
  } catch (err) {
    alert('Failed to delete message');
  }
});

// Clear Mailbox
clearCurrentInboxBtn.addEventListener('click', async () => {
  if (!confirm(`Purge all emails in ${currentAddress}?`)) return;
  try {
    await fetch(`/api/inbox/${encodeURIComponent(currentAddress)}`, {
      method: 'DELETE',
    });
    selectedMessage = null;
    noMessageSelected.classList.remove('hidden');
    activeMessageViewer.classList.add('hidden');
    discordBanner.classList.add('hidden');
    loadMessages();
  } catch (err) {
    alert('Failed to clear inbox');
  }
});

// Sync / Refresh
refreshInboxBtn.addEventListener('click', () => {
  loadMessages();
  checkDiscordVerification();
});

// Search Filter
feedSearchInput.addEventListener('input', () => {
  renderFeed();
});

// Sound Toggle
soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('cyber_sound', soundEnabled);
  updateSoundUI();
  if (soundEnabled) playCyberChime();
});

function updateSoundUI() {
  if (soundEnabled) {
    soundIcon.textContent = '🔔';
    soundText.textContent = 'Sound ON';
  } else {
    soundIcon.textContent = '🔕';
    soundText.textContent = 'Muted';
  }
}

// QR Code Modal
openQrBtn.addEventListener('click', () => {
  qrAddressText.textContent = currentAddress;
  if (window.QRCode) {
    QRCode.toCanvas(qrCanvas, currentAddress, { width: 200, margin: 1 }, (err) => {
      if (err) console.error(err);
    });
  }
  qrModal.classList.remove('hidden');
});

closeQrModalBtn.addEventListener('click', () => {
  qrModal.classList.add('hidden');
});

// ==============================================================================
// 7. ADMIN PORTAL & API KEY VAULT (Admin Login Only)
// ==============================================================================

openAdminBtn.addEventListener('click', () => {
  adminModal.classList.remove('hidden');
  checkAdminSession();
});

closeAdminModalBtn.addEventListener('click', () => {
  adminModal.classList.add('hidden');
});

async function checkAdminSession() {
  if (!adminToken) {
    showAdminLogin();
    return;
  }

  try {
    const res = await fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (data.valid) {
      showAdminVault();
    } else {
      adminToken = null;
      localStorage.removeItem('cyber_admin_token');
      showAdminLogin();
    }
  } catch {
    showAdminLogin();
  }
}

function showAdminLogin() {
  adminLoginFormContainer.classList.remove('hidden');
  adminKeyVaultContainer.classList.add('hidden');
  adminLoginError.classList.add('hidden');
  adminPasswordInput.value = '';
}

function showAdminVault() {
  adminLoginFormContainer.classList.add('hidden');
  adminKeyVaultContainer.classList.remove('hidden');
  loadAdminKeys();
}

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = adminPasswordInput.value.trim();
  if (!password) return;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      adminToken = data.token;
      localStorage.setItem('cyber_admin_token', adminToken);
      showAdminVault();
    } else {
      adminLoginError.textContent = data.error || 'Invalid admin credentials';
      adminLoginError.classList.remove('hidden');
    }
  } catch {
    adminLoginError.textContent = 'Server connection failed';
    adminLoginError.classList.remove('hidden');
  }
});

adminLogoutBtn.addEventListener('click', () => {
  if (adminToken) {
    fetch('/api/admin/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    }).catch(() => {});
  }
  adminToken = null;
  localStorage.removeItem('cyber_admin_token');
  showAdminLogin();
});

async function loadAdminKeys() {
  if (!adminToken) return;
  try {
    const res = await fetch('/api/admin/keys', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const keys = data.keys || [];

    if (keys.length === 0) {
      activeKeysList.innerHTML = '<div class="text-xs font-mono text-gray-500">No active keys generated yet.</div>';
      return;
    }

    activeKeysList.innerHTML = keys
      .map(
        (k) => `
      <div class="neo-inset p-3 rounded-xl flex items-center justify-between text-xs font-mono">
        <div>
          <div class="text-white font-bold">${escapeHtml(k.name)} <span class="text-[10px] text-cyan-400 font-normal">[${k.permissions}]</span></div>
          <div class="text-[11px] text-gray-400 mt-0.5">${k.prefix}</div>
          <div class="text-[10px] text-gray-500">Created: ${new Date(k.created_at).toLocaleDateString()} ${k.last_used_at ? '• Active' : ''}</div>
        </div>
        <button class="revoke-key-btn text-xs text-red-400 hover:text-red-300 font-mono" data-id="${k.id}">
          Revoke
        </button>
      </div>
    `
      )
      .join('');

    document.querySelectorAll('.revoke-key-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!confirm('Revoke this API Key immediately?')) return;
        await fetch(`/api/admin/keys/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        loadAdminKeys();
      });
    });
  } catch (err) {
    console.error('Failed to load keys:', err);
  }
}

createApiKeyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = newKeyNameInput.value.trim();
  const permissions = newKeyPermSelect.value;
  if (!name) return;

  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name, permissions }),
    });
    const data = await res.json();
    if (data.success && data.key) {
      newKeyAlert.classList.remove('hidden');
      newKeyValueDisplay.value = data.key.key;
      newKeyNameInput.value = '';
      loadAdminKeys();
    }
  } catch {
    alert('Failed to generate key');
  }
});

copyNewKeyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(newKeyValueDisplay.value).then(() => {
    copyNewKeyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyNewKeyBtn.textContent = 'Copy';
    }, 2000);
  });
});

// ==============================================================================
// 8. INTERACTIVE CYBER API CHECKER / TESTER (Requested Feature)
// ==============================================================================

openApiTesterBtn.addEventListener('click', () => {
  testerAddressInput.value = currentAddress;
  apiTesterModal.classList.remove('hidden');
});

closeApiTesterBtn.addEventListener('click', () => {
  apiTesterModal.classList.add('hidden');
});

runApiTestBtn.addEventListener('click', async () => {
  const endpoint = testerEndpointSelect.value;
  const address = testerAddressInput.value.trim() || currentAddress;
  const apiKey = testerApiKeyInput.value.trim();

  let url = '';
  let method = 'GET';
  let body = null;
  const headers = {};

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  if (endpoint === 'messages') {
    url = `/api/messages/${encodeURIComponent(address)}`;
  } else if (endpoint === 'discord') {
    url = `/api/discord/${encodeURIComponent(address)}?wait=false`;
  } else if (endpoint === 'check-key') {
    url = '/api/admin/check-key';
    method = 'POST';
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ apiKey });
  } else if (endpoint === 'stats') {
    url = '/api/stats';
  } else if (endpoint === 'create-inbox') {
    url = '/api/inbox/create';
    method = 'POST';
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ address });
  }

  testerStatusCode.textContent = 'Connecting...';
  testerStatusCode.className = 'px-2 py-0.5 rounded font-bold bg-yellow-500/20 text-yellow-300';
  testerResponseBox.textContent = 'Transmitting request packet...';

  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
    });
    const t1 = performance.now();
    const latency = Math.round(t1 - t0);
    testerLatency.textContent = `${latency}ms`;

    const statusText = `${res.status} ${res.statusText}`;
    testerStatusCode.textContent = statusText;
    if (res.ok) {
      testerStatusCode.className = 'px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400';
    } else {
      testerStatusCode.className = 'px-2 py-0.5 rounded font-bold bg-red-500/20 text-red-400';
    }

    const json = await res.json();
    testerResponseBox.textContent = JSON.stringify(json, null, 2);
  } catch (err) {
    const t1 = performance.now();
    testerLatency.textContent = `${Math.round(t1 - t0)}ms`;
    testerStatusCode.textContent = 'Network Error';
    testerStatusCode.className = 'px-2 py-0.5 rounded font-bold bg-red-500/20 text-red-400';
    testerResponseBox.textContent = JSON.stringify({ error: err.message }, null, 2);
  }
});

copyCurlBtn.addEventListener('click', () => {
  const endpoint = testerEndpointSelect.value;
  const address = testerAddressInput.value.trim() || currentAddress;
  const apiKey = testerApiKeyInput.value.trim();
  const host = window.location.origin;

  let curl = '';
  if (endpoint === 'messages') {
    curl = `curl -X GET "${host}/api/messages/${address}"`;
  } else if (endpoint === 'discord') {
    curl = `curl -X GET "${host}/api/discord/${address}?wait=true&timeout=30"`;
  } else if (endpoint === 'check-key') {
    curl = `curl -X POST "${host}/api/admin/check-key" \\\n  -H "Content-Type: application/json" \\\n  -d '{"apiKey": "${apiKey || 'YOUR_KEY_HERE'}"}'`;
  } else if (endpoint === 'stats') {
    curl = `curl -X GET "${host}/api/stats"`;
  } else if (endpoint === 'create-inbox') {
    curl = `curl -X POST "${host}/api/inbox/create" \\\n  -H "Content-Type: application/json" \\\n  -d '{"address": "${address}"}'`;
  }

  if (apiKey && endpoint !== 'check-key') {
    curl += ` \\\n  -H "x-api-key: ${apiKey}"`;
  }

  navigator.clipboard.writeText(curl).then(() => {
    copyCurlBtn.innerHTML = '<span>✓</span> <span>Copied cURL!</span>';
    setTimeout(() => {
      copyCurlBtn.innerHTML = '<span>📋</span> <span>Copy cURL</span>';
    }, 2000);
  });
});

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Boot application
initApp();
