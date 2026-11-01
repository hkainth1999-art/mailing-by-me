// ==============================================================================
// 👑 CROWN MAIL VAULT — CLIENT CONTROLLER & CLAYMORPHIC ENGINE
// ==============================================================================

// Application State
let currentAddress = '';
let currentDomain = '';
let availableDomains = [];
let messages = [];
let selectedMessage = null;
let soundEnabled = localStorage.getItem('crown_sound') !== 'false';
let currentUser = null; // { loggedIn: false, user: null }
let ws = null;
let wsHeartbeat = null;
let recentMailboxes = [];

// Cleanse any legacy or 'cyber' addresses from localStorage immediately
function purgeLegacyCyberStorage() {
  try {
    localStorage.removeItem('cyber_recent_mailboxes');
    localStorage.removeItem('cyber_admin_token');
    localStorage.removeItem('cyber_sound');
  } catch {}

  try {
    const raw = localStorage.getItem('crown_recent_mailboxes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        recentMailboxes = parsed.filter(
          (addr) => typeof addr === 'string' && addr.includes('@') && !addr.toLowerCase().includes('cyber')
        );
      }
    }
    localStorage.setItem('crown_recent_mailboxes', JSON.stringify(recentMailboxes));
  } catch {
    recentMailboxes = [];
  }
}
purgeLegacyCyberStorage();

// Web Audio API Synthesizer (Chime)
let audioCtx = null;
function playVaultChime() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now); // G5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.14); // C6
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now + 0.14); // E6
    gain2.gain.setValueAtTime(0.18, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// DOM Elements
const authRequiredBanner = document.getElementById('authRequiredBanner');
const bannerLoginBtn = document.getElementById('bannerLoginBtn');
const discordLoginBtn = document.getElementById('discordLoginBtn');
const discordUserPill = document.getElementById('discordUserPill');
const userAvatarImg = document.getElementById('userAvatarImg');
const userUsernameText = document.getElementById('userUsernameText');
const userRoleBadge = document.getElementById('userRoleBadge');
const discordLogoutBtn = document.getElementById('discordLogoutBtn');
const openAdminBtn = document.getElementById('openAdminBtn');

const pasteInboxForm = document.getElementById('pasteInboxForm');
const pasteInboxInput = document.getElementById('pasteInboxInput');
const randomMailBtn = document.getElementById('randomMailBtn');
const openCreateCustomBtn = document.getElementById('openCreateCustomBtn');
const customCreateDrawer = document.getElementById('customCreateDrawer');
const customCreateForm = document.getElementById('customCreateForm');
const customUsernameInput = document.getElementById('customUsernameInput');
const customDomainSelect = document.getElementById('customDomainSelect');
const recentMailboxesList = document.getElementById('recentMailboxesList');

const userInboxesTabContainer = document.getElementById('userInboxesTabContainer');
const toggleUserInboxesBtn = document.getElementById('toggleUserInboxesBtn');
const userInboxesCountBadge = document.getElementById('userInboxesCountBadge');
const userInboxesDrawer = document.getElementById('userInboxesDrawer');
const userInboxesList = document.getElementById('userInboxesList');

const preservedStateBanner = document.getElementById('preservedStateBanner');
const activeAddressDisplay = document.getElementById('activeAddressDisplay');
const copyActiveAddressBtn = document.getElementById('copyActiveAddressBtn');
const copyBtnText = document.getElementById('copyBtnText');
const activePreserveBadge = document.getElementById('activePreserveBadge');
const activePreserveText = document.getElementById('activePreserveText');
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
const discordAuthModal = document.getElementById('discordAuthModal');
const closeDiscordAuthModalBtn = document.getElementById('closeDiscordAuthModalBtn');
const discordOAuthBtnLink = document.getElementById('discordOAuthBtnLink');
const devLoginForm = document.getElementById('devLoginForm');
const devDiscordIdInput = document.getElementById('devDiscordIdInput');
const devUsernameInput = document.getElementById('devUsernameInput');

const adminModal = document.getElementById('adminModal');
const closeAdminModalBtn = document.getElementById('closeAdminModalBtn');
const adminTabs = document.querySelectorAll('.admin-tab');
const addDomainForm = document.getElementById('addDomainForm');
const newDomainInput = document.getElementById('newDomainInput');
const newDomainDefaultCheck = document.getElementById('newDomainDefaultCheck');
const activeDomainsList = document.getElementById('activeDomainsList');

const statMailboxes = document.getElementById('statMailboxes');
const statPreserved = document.getElementById('statPreserved');
const statMessages = document.getElementById('statMessages');
const statCompressed = document.getElementById('statCompressed');
const triggerPreserveBtn = document.getElementById('triggerPreserveBtn');
const preserveStatusAlert = document.getElementById('preserveStatusAlert');

const createApiKeyForm = document.getElementById('createApiKeyForm');
const newKeyNameInput = document.getElementById('newKeyNameInput');
const newKeyPermSelect = document.getElementById('newKeyPermSelect');
const newKeyAlert = document.getElementById('newKeyAlert');
const newKeyValueDisplay = document.getElementById('newKeyValueDisplay');
const copyNewKeyBtn = document.getElementById('copyNewKeyBtn');
const activeKeysList = document.getElementById('activeKeysList');

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

// ==============================================================================
// 1. RANDOM NAME & ALPHABET NUMBER GENERATOR (NO 'cyber' ANYWHERE)
// ==============================================================================

// Natural Human First Names
const FIRST_NAMES = [
  'alex', 'sarah', 'david', 'oliver', 'emma', 'lucas', 'marcus', 'liam', 'noah',
  'ethan', 'chloe', 'ryan', 'leo', 'jordan', 'daniel', 'sophia', 'elena', 'jack',
  'mason', 'clara', 'victor', 'arthur', 'felix', 'samuel', 'oscar', 'henry', 'eva',
  'adam', 'ben', 'dylan', 'finn', 'ian', 'jake', 'kyle', 'luke', 'max', 'nate',
  'owen', 'quinn', 'seth', 'troy', 'zane', 'maya', 'zoe', 'lily', 'nora', 'aria',
  'mila', 'isla', 'harper', 'grace', 'carter', 'miles', 'cole', 'reid', 'blake'
];

// Natural Surnames
const LAST_NAMES = [
  'turner', 'miller', 'stone', 'reed', 'watson', 'gray', 'clark', 'bennett',
  'morgan', 'davies', 'brooks', 'foster', 'hayes', 'vance', 'cole', 'wright',
  'ward', 'bell', 'cooper', 'ross', 'parker', 'evans', 'wood', 'price', 'allen'
];

// Modern Alphabet & Mail Brand Words
const ALPHABET_WORDS = [
  'crwnmail', 'crown', 'vortex', 'phantom', 'zenith', 'kronos', 'apex', 'pulse',
  'shadow', 'frost', 'astral', 'valkyrie', 'specter', 'storm', 'nexus', 'titan',
  'velocity', 'aurora', 'phoenix', 'solaris', 'echo', 'blade', 'flux', 'radiant',
  'noble', 'vector', 'prime', 'shield', 'falcon', 'drift', 'haven', 'cipher',
  'temp', 'nova', 'strider', 'alpha', 'omega', 'swift', 'krypton', 'hyper'
];

// Multi-style generator based on human names, alphabet, and numbers
function generateRandomMailboxName() {
  const mode = Math.floor(Math.random() * 4);
  let name = '';

  if (mode === 0) {
    // Mode 0: First Name + 1-3 random digits (e.g. sarah84, alex92, oliver7)
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const num = Math.floor(Math.random() * 99) + 1;
    name = `${fn}${num}`;
  } else if (mode === 1) {
    // Mode 1: First Name + '.' + Last Name (e.g. alex.turner, sarah.miller)
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    name = `${fn}.${ln}`;
  } else if (mode === 2) {
    // Mode 2: Alphabet / Brand Word + 2-digit number (e.g. crwnmail24, vortex42, kronos99)
    const word = ALPHABET_WORDS[Math.floor(Math.random() * ALPHABET_WORDS.length)];
    const num = Math.floor(Math.random() * 90) + 10;
    name = `${word}${num}`;
  } else {
    // Mode 3: Short alphabet letters + numbers (e.g. alx84, sar92, dvd21, mrc12)
    const fn = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const shortPrefix = fn.slice(0, 3);
    const num = Math.floor(Math.random() * 900) + 10;
    name = `${shortPrefix}${num}`;
  }

  // Strict validation: NEVER allow the word 'cyber'
  if (name.toLowerCase().includes('cyber')) {
    return generateRandomMailboxName();
  }

  return name.toLowerCase();
}

// ==============================================================================
// 2. CLEAN ROUTE & URL RESOLVER (Fixes #cyber-... URL route issues)
// ==============================================================================

function getCleanAddressFromURL() {
  // 1. Check pathname: /inbox/user@domain or /user@domain
  const rawPath = window.location.pathname.replace(/^\/+/, '').trim();
  if (rawPath) {
    if (rawPath.startsWith('inbox/')) {
      const candidate = decodeURIComponent(rawPath.replace(/^inbox\//, '')).trim();
      if (candidate.includes('@') && !candidate.toLowerCase().includes('cyber')) {
        return candidate.toLowerCase();
      }
    } else if (rawPath.includes('@') && !rawPath.toLowerCase().includes('cyber')) {
      return decodeURIComponent(rawPath).toLowerCase();
    }
  }

  // 2. Check hash: #/inbox/user@domain or #user@domain
  const rawHash = window.location.hash.replace(/^#[/]?/, '').trim();
  if (rawHash) {
    const candidate = decodeURIComponent(rawHash.replace(/^inbox\//, '')).trim();
    if (candidate.includes('@') && !candidate.toLowerCase().includes('cyber')) {
      return candidate.toLowerCase();
    }
  }

  return null;
}

// Update URL cleanly using HTML5 History API (no messy or old #cyber-... hash)
function updateCleanURLRoute(address) {
  const cleanRoute = `/inbox/${encodeURIComponent(address)}`;
  if (window.location.pathname !== cleanRoute || window.location.hash) {
    window.history.replaceState({ address }, '', cleanRoute);
  }
}

// Standby Mode: No email is automatically created on visit or login!
function setStandbyMode() {
  currentAddress = '';
  activeAddressDisplay.textContent = 'No Mailbox Active';
  activeAddressDisplay.className = 'text-base sm:text-lg font-mono text-gray-500 italic select-none';
  pasteInboxInput.value = '';
  testerAddressInput.value = '';
  activePreserveBadge.classList.add('hidden');
  preservedStateBanner.classList.add('hidden');

  copyActiveAddressBtn.classList.add('opacity-40', 'cursor-not-allowed');
  openQrBtn.classList.add('opacity-40', 'cursor-not-allowed');
  clearCurrentInboxBtn.classList.add('opacity-40', 'cursor-not-allowed');
  refreshInboxBtn.classList.add('opacity-40', 'cursor-not-allowed');

  selectedMessage = null;
  noMessageSelected.classList.remove('hidden');
  activeMessageViewer.classList.add('hidden');
  messagesList.innerHTML = '';
  feedCountBadge.textContent = '0';
  emptyFeedState.classList.remove('hidden');
  emptyFeedState.innerHTML = `
    <div class="w-12 h-12 rounded-2xl clay-inset flex items-center justify-center text-gray-500">
      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
    </div>
    <div>
      <h4 class="text-sm font-mono font-bold text-gray-300">No Mailbox Active</h4>
      <p class="text-xs text-gray-500 font-mono mt-1 max-w-xs">
        Click <strong class="text-cyan-400">"Random Mail"</strong>, <strong class="text-emerald-400">"Custom"</strong>, or paste an address to open an inbox.
      </p>
    </div>
  `;
}

// ==============================================================================
// 3. BOOT & AUTHENTICATION MANAGEMENT
// ==============================================================================

async function initApp() {
  updateSoundUI();

  // Load Domains from Server (Managed dynamically in Admin Panel)
  await loadDomains();

  // Check Discord Authentication (Does NOT auto-create mail)
  await checkDiscordAuth();

  // Check clean address from URL (ignoring any old cyber hash/route)
  const routeAddress = getCleanAddressFromURL();
  if (routeAddress) {
    setAddress(routeAddress);
  } else {
    // STANDBY: Do NOT auto-create any mailbox when visiting site or logging in!
    setStandbyMode();
  }

  renderRecentMailboxes();
}

// Listen to browser navigation (back/forward)
window.addEventListener('popstate', (e) => {
  const routeAddress = getCleanAddressFromURL();
  if (routeAddress) {
    setAddress(routeAddress, false);
  }
});

async function loadDomains() {
  try {
    const res = await fetch('/api/domains');
    const data = await res.json();
    availableDomains = data.domains || ['crwnmail.com'];
    currentDomain = data.default || availableDomains[0] || 'crwnmail.com';
  } catch (err) {
    availableDomains = ['crwnmail.com', 'rizzcord.site'];
    currentDomain = 'crwnmail.com';
  }

  updateDomainSelects();
}

function updateDomainSelects() {
  const optionsHtml = availableDomains
    .map((d) => `<option value="${d}" ${d === currentDomain ? 'selected' : ''}>${d}</option>`)
    .join('');

  mainDomainSelect.innerHTML = optionsHtml;
  customDomainSelect.innerHTML = optionsHtml;
}

// Discord Auth Checker (Uses secure HttpOnly cookie session)
async function checkDiscordAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    currentUser = data;

    if (data.loggedIn && data.user) {
      // User is logged in
      authRequiredBanner.classList.add('hidden');
      discordLoginBtn.classList.add('hidden');
      discordUserPill.classList.remove('hidden');

      userUsernameText.textContent = data.user.globalName || data.user.username;
      if (data.user.avatar) {
        userAvatarImg.src = data.user.avatar;
      } else {
        userAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.username)}&background=5865F2&color=fff`;
      }

      // Check if user is OWNER
      if (data.user.isOwner) {
        userRoleBadge.classList.remove('hidden');
        openAdminBtn.classList.remove('hidden');
      } else {
        userRoleBadge.classList.add('hidden');
        openAdminBtn.classList.add('hidden');
      }

      // Show user created inboxes tab
      userInboxesTabContainer.classList.remove('hidden');
      loadUserInboxes();
    } else {
      // User is NOT logged in
      authRequiredBanner.classList.remove('hidden');
      discordLoginBtn.classList.remove('hidden');
      discordUserPill.classList.add('hidden');
      openAdminBtn.classList.add('hidden');
      userInboxesTabContainer.classList.add('hidden');

      // Setup Discord OAuth link if configured
      if (data.discordOAuthConfigured) {
        fetch('/api/auth/discord')
          .then((r) => r.json())
          .then((authData) => {
            if (authData.configured && authData.url) {
              discordOAuthBtnLink.href = authData.url;
            }
          })
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error('Failed to check auth state:', err);
  }
}

// User Created Inboxes
async function loadUserInboxes() {
  try {
    const res = await fetch('/api/user/inboxes');
    const data = await res.json();
    const mailboxes = data.mailboxes || [];
    userInboxesCountBadge.textContent = mailboxes.length;

    if (mailboxes.length === 0) {
      userInboxesList.innerHTML = '<span class="text-xs text-gray-500 font-mono">No mailboxes created under your Discord account yet.</span>';
      return;
    }

    userInboxesList.innerHTML = mailboxes
      .map(
        (m) => `
        <button class="user-inbox-chip clay-pill px-2.5 py-1 text-xs font-mono text-cyan-300 hover:text-white flex items-center gap-1.5" data-addr="${m.address}">
          <span>📬</span>
          <span>${m.address}</span>
          ${m.is_preserved ? '<span class="text-[9px] text-cyan-400 font-bold">❄️</span>' : ''}
          <span class="text-[10px] text-gray-400">(${m.count})</span>
        </button>
      `
      )
      .join('');

    document.querySelectorAll('.user-inbox-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        setAddress(btn.getAttribute('data-addr'));
      });
    });
  } catch (err) {}
}

toggleUserInboxesBtn.addEventListener('click', () => {
  userInboxesDrawer.classList.toggle('hidden');
});

// Logout
discordLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.reload();
});

// Prompt Discord Auth Modal
function promptDiscordLogin() {
  discordAuthModal.classList.remove('hidden');
}

discordLoginBtn.addEventListener('click', promptDiscordLogin);
bannerLoginBtn.addEventListener('click', promptDiscordLogin);

closeDiscordAuthModalBtn.addEventListener('click', () => {
  discordAuthModal.classList.add('hidden');
});

// Dev Direct Discord Login
devLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const discordId = devDiscordIdInput.value.trim();
  const username = devUsernameInput.value.trim();
  if (!discordId) return;

  try {
    const res = await fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId, username }),
    });
    const data = await res.json();
    if (data.success) {
      discordAuthModal.classList.add('hidden');
      await checkDiscordAuth();
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    alert('Failed to connect to server');
  }
});

// ==============================================================================
// 4. MAILBOX NAVIGATION & 24H PRESERVATION STATE
// ==============================================================================

function setAddress(addr, updateHistory = true) {
  let clean = (addr || '').toLowerCase().trim();

  // If address contains 'cyber' or is invalid, instantly regenerate with proper name/alphabet+number
  if (!clean || clean.includes('cyber') || !clean.includes('@')) {
    const parts = clean.split('@');
    const domain = (parts[1] && availableDomains.includes(parts[1])) ? parts[1] : currentDomain;
    clean = `${generateRandomMailboxName()}@${domain}`;
  }

  currentAddress = clean;

  // Clean HTML5 route: update URL to /inbox/user@domain (removes any #cyber-... in the browser)
  if (updateHistory) {
    updateCleanURLRoute(currentAddress);
  }

  activeAddressDisplay.className = 'text-lg sm:text-xl font-mono font-black text-white tracking-tight select-all';
  activeAddressDisplay.textContent = currentAddress;
  pasteInboxInput.value = currentAddress;
  testerAddressInput.value = currentAddress;

  copyActiveAddressBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  openQrBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  clearCurrentInboxBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  refreshInboxBtn.classList.remove('opacity-40', 'cursor-not-allowed');
  activePreserveBadge.classList.remove('hidden');

  const parts = currentAddress.split('@');
  if (parts[1] && availableDomains.includes(parts[1])) {
    mainDomainSelect.value = parts[1];
    currentDomain = parts[1];
  }

  saveRecentMailbox(currentAddress);

  // Reset viewer
  selectedMessage = null;
  noMessageSelected.classList.remove('hidden');
  activeMessageViewer.classList.add('hidden');

  // Load messages and evaluate preservation state
  loadMessages();
  checkDiscordVerification();

  // Connect live WebSocket stream
  connectWebSocket();
}

function saveRecentMailbox(addr) {
  if (!addr || addr.toLowerCase().includes('cyber')) return;
  recentMailboxes = recentMailboxes.filter((a) => a !== addr && !a.toLowerCase().includes('cyber'));
  recentMailboxes.unshift(addr);
  if (recentMailboxes.length > 8) {
    recentMailboxes = recentMailboxes.slice(0, 8);
  }
  localStorage.setItem('crown_recent_mailboxes', JSON.stringify(recentMailboxes));
  renderRecentMailboxes();
}

function renderRecentMailboxes() {
  // Strip any accidental 'cyber' from display
  recentMailboxes = recentMailboxes.filter((a) => !a.toLowerCase().includes('cyber'));

  if (!recentMailboxes.length) {
    recentMailboxesList.innerHTML = '<span class="text-[11px] font-mono text-gray-600">None yet</span>';
    return;
  }
  recentMailboxesList.innerHTML = recentMailboxes
    .map(
      (addr) => `
      <button class="recent-mailbox-chip clay-pill px-2.5 py-1 text-[11px] font-mono text-gray-300 hover:text-cyan-300 transition flex items-center gap-1 ${
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

// Load Messages & Check Preserved State
async function loadMessages() {
  if (!currentAddress) return;

  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(currentAddress)}`);
    const data = await res.json();
    messages = data.messages || [];

    // Check if inbox is in Preserved Cold Storage state (> 24 hours)
    if (data.is_preserved) {
      preservedStateBanner.classList.remove('hidden');
      activePreserveText.textContent = 'Preserved Cold Vault Active (0 Deletions)';
    } else {
      preservedStateBanner.classList.add('hidden');
      activePreserveText.textContent = 'Active SQLite Vault';
    }

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
      const isCompressed = Boolean(msg.is_compressed);

      return `
        <div class="message-card p-3 rounded-2xl cursor-pointer clay-card-hover ${
          isSelected ? 'clay-inset border-cyan-500/40' : 'clay-card'
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
              isCompressed
                ? `<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">❄️ Preserved</span>`
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

// View Full Message
async function viewMessage(id) {
  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(currentAddress)}/${id}`);
    const data = await res.json();
    if (!data.message) return;

    selectedMessage = data.message;
    renderFeed();

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
        <span class="clay-inset px-2.5 py-1 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-1.5">
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

    const htmlContent = selectedMessage.html_body || `<pre style="font-family: monospace; white-space: pre-wrap; padding: 16px;">${escapeHtml(selectedMessage.text_body || 'No text content')}</pre>`;
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
      tab.className = 'view-tab clay-pill px-3 py-1 text-xs font-mono text-cyan-400 font-bold border-cyan-500/40';
    } else {
      tab.className = 'view-tab clay-btn px-3 py-1 text-xs font-mono text-gray-400 hover:text-white';
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

// Check Discord Verification Code
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

// WebSocket Connection
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
      wsStatusBadge.className = 'clay-pill flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-mono text-emerald-400 border border-emerald-500/20';
      wsStatusText.textContent = 'VAULT LIVE';

      wsHeartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_message') {
          playVaultChime();
          loadMessages();
          checkDiscordVerification();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      wsStatusBadge.className = 'clay-pill flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-mono text-yellow-400 border border-yellow-500/20';
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

// ==============================================================================
// 5. ACTION HANDLERS: CREATING, RESTORING, RANDOMIZING
// ==============================================================================

// Paste & Open Form (Can open any existing or preserved inbox directly!)
pasteInboxForm.addEventListener('submit', (e) => {
  e.preventDefault();
  let inputVal = pasteInboxInput.value.trim();
  if (!inputVal) return;

  if (!inputVal.includes('@')) {
    inputVal = `${inputVal}@${currentDomain}`;
  }
  setAddress(inputVal);
});

// Random Mail Button (Requires Discord Login! Generates proper alphabet / name, NO 'cyber')
randomMailBtn.addEventListener('click', async () => {
  if (!currentUser || !currentUser.loggedIn) {
    promptDiscordLogin();
    return;
  }

  const properName = generateRandomMailboxName();
  const fullAddress = `${properName}@${currentDomain}`;

  try {
    const res = await fetch('/api/inbox/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: fullAddress }),
    });
    const data = await res.json();
    if (data.success) {
      setAddress(fullAddress);
      loadUserInboxes();
    } else {
      alert(data.error || 'Failed to create mailbox');
    }
  } catch (err) {
    setAddress(fullAddress);
  }
});

// Custom Drawer Toggle
openCreateCustomBtn.addEventListener('click', () => {
  if (!currentUser || !currentUser.loggedIn) {
    promptDiscordLogin();
    return;
  }
  customCreateDrawer.classList.toggle('hidden');
});

// Custom Mailbox Creation
customCreateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser || !currentUser.loggedIn) {
    promptDiscordLogin();
    return;
  }

  let username = customUsernameInput.value.trim().toLowerCase();
  const domain = customDomainSelect.value;
  if (!username) return;

  // Filter out 'cyber' if someone types it in custom username
  username = username.replace(/cyber[-_]?/gi, '');
  if (!username) username = generateRandomMailboxName();

  const fullAddress = `${username}@${domain}`;

  try {
    const res = await fetch('/api/inbox/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: fullAddress }),
    });
    const data = await res.json();
    if (data.success) {
      setAddress(fullAddress);
      customUsernameInput.value = '';
      customCreateDrawer.classList.add('hidden');
      loadUserInboxes();
    } else {
      alert(data.error || 'Failed to create mailbox');
    }
  } catch {
    setAddress(fullAddress);
  }
});

// Domain Selector Change
mainDomainSelect.addEventListener('change', (e) => {
  currentDomain = e.target.value;
  if (!currentAddress) return; // Do NOT auto-create if in standby
  const parts = currentAddress.split('@');
  const user = parts[0] || generateRandomMailboxName();
  setAddress(`${user}@${currentDomain}`);
});

// Copy Address
copyActiveAddressBtn.addEventListener('click', () => {
  if (!currentAddress) return;
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

// Delete Single Message
deleteMessageBtn.addEventListener('click', async () => {
  if (!selectedMessage || !currentAddress) return;
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

// Clear Inbox
clearCurrentInboxBtn.addEventListener('click', async () => {
  if (!currentAddress) return;
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
  if (!currentAddress) return;
  loadMessages();
  checkDiscordVerification();
});
  checkDiscordVerification();
});

// Search Filter
feedSearchInput.addEventListener('input', () => {
  renderFeed();
});

// Audio Toggle
soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('crown_sound', soundEnabled);
  updateSoundUI();
  if (soundEnabled) playVaultChime();
});

function updateSoundUI() {
  if (soundEnabled) {
    soundText.textContent = 'Sound ON';
  } else {
    soundText.textContent = 'Muted';
  }
}

// QR Code Modal
openQrBtn.addEventListener('click', () => {
  if (!currentAddress) return;
  qrAddressText.textContent = currentAddress;
  if (window.QRCode) {
    QRCode.toCanvas(qrCanvas, currentAddress, { width: 220, margin: 1 }, (err) => {
      if (err) console.error(err);
    });
  }
  qrModal.classList.remove('hidden');
});

closeQrModalBtn.addEventListener('click', () => {
  qrModal.classList.add('hidden');
});

// ==============================================================================
// 6. ADMIN CONTROL VAULT (OWNER ACCESS, MULTI-DOMAIN, COLD STATS)
// ==============================================================================

openAdminBtn.addEventListener('click', () => {
  adminModal.classList.remove('hidden');
  loadAdminDomains();
  loadAdminStats();
  loadAdminKeys();
});

closeAdminModalBtn.addEventListener('click', () => {
  adminModal.classList.add('hidden');
});

// Admin Tab Navigation
adminTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-tab');
    adminTabs.forEach((t) => {
      t.className = 'admin-tab clay-btn px-3.5 py-1.5 text-gray-400 hover:text-white';
    });
    tab.className = 'admin-tab clay-pill px-3.5 py-1.5 text-amber-300 border-amber-500/40 font-bold';

    document.querySelectorAll('.admin-pane').forEach((p) => p.classList.add('hidden'));

    if (target === 'domains') document.getElementById('adminTabDomains').classList.remove('hidden');
    if (target === 'stats') document.getElementById('adminTabStats').classList.remove('hidden');
    if (target === 'keys') document.getElementById('adminTabKeys').classList.remove('hidden');
    if (target === 'security') document.getElementById('adminTabSecurity').classList.remove('hidden');
  });
});

// Multi-Domain Operations (Admin)
async function loadAdminDomains() {
  try {
    const res = await fetch('/api/admin/domains');
    if (res.status === 403) {
      alert('Access denied. Owner authorization required.');
      adminModal.classList.add('hidden');
      return;
    }
    const data = await res.json();
    const domains = data.domains || [];

    if (domains.length === 0) {
      activeDomainsList.innerHTML = '<div class="text-xs font-mono text-gray-500">No domains configured.</div>';
      return;
    }

    activeDomainsList.innerHTML = domains
      .map(
        (d) => `
      <div class="clay-inset p-3.5 rounded-xl flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-3">
          <span class="text-white font-bold text-sm">${escapeHtml(d.domain)}</span>
          ${
            d.is_default
              ? '<span class="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">DEFAULT</span>'
              : ''
          }
        </div>
        <div class="flex items-center gap-2">
          ${
            !d.is_default
              ? `<button class="set-default-domain-btn clay-btn px-2.5 py-1 text-[11px] text-cyan-300 hover:text-white" data-domain="${d.domain}">Set Default</button>`
              : ''
          }
          <button class="delete-domain-btn clay-btn px-2.5 py-1 text-[11px] text-red-400 hover:text-red-300" data-domain="${d.domain}">
            Delete
          </button>
        </div>
      </div>
    `
      )
      .join('');

    // Attach Action Listeners
    document.querySelectorAll('.set-default-domain-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dom = btn.getAttribute('data-domain');
        await fetch(`/api/admin/domains/${encodeURIComponent(dom)}/default`, { method: 'PUT' });
        await loadDomains();
        loadAdminDomains();
      });
    });

    document.querySelectorAll('.delete-domain-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const dom = btn.getAttribute('data-domain');
        if (!confirm(`Delete domain "${dom}" from SMTP and web server?`)) return;
        const delRes = await fetch(`/api/admin/domains/${encodeURIComponent(dom)}`, { method: 'DELETE' });
        const delData = await delRes.json();
        if (delData.error) {
          alert(delData.error);
        } else {
          await loadDomains();
          loadAdminDomains();
        }
      });
    });
  } catch (err) {
    console.error('Failed to load admin domains:', err);
  }
}

// Add New Domain (Admin)
addDomainForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const domain = newDomainInput.value.trim().toLowerCase();
  const isDefault = newDomainDefaultCheck.checked;
  if (!domain) return;

  try {
    const res = await fetch('/api/admin/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, isDefault }),
    });
    const data = await res.json();
    if (data.success) {
      newDomainInput.value = '';
      newDomainDefaultCheck.checked = false;
      await loadDomains();
      loadAdminDomains();
    } else {
      alert(data.error || 'Failed to add domain');
    }
  } catch (err) {
    alert('Failed to connect to server');
  }
});

// Admin Stats
async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    statMailboxes.textContent = data.mailboxes || 0;
    statPreserved.textContent = data.preserved_mailboxes || 0;
    statMessages.textContent = data.messages || 0;
    statCompressed.textContent = data.compressed_messages || 0;
  } catch {}
}

// Trigger Compression Pass Now
triggerPreserveBtn.addEventListener('click', async () => {
  triggerPreserveBtn.textContent = 'Running...';
  try {
    const res = await fetch('/api/admin/preserve-now', { method: 'POST' });
    const data = await res.json();
    preserveStatusAlert.textContent = '✓ Preservation and cold compression pass completed successfully.';
    preserveStatusAlert.classList.remove('hidden');
    loadAdminStats();
  } catch {
    preserveStatusAlert.textContent = 'Pass execution error.';
    preserveStatusAlert.classList.remove('hidden');
  } finally {
    triggerPreserveBtn.textContent = 'Run Compression Pass Now';
  }
});

// Admin Keys
async function loadAdminKeys() {
  try {
    const res = await fetch('/api/admin/keys');
    const data = await res.json();
    const keys = data.keys || [];

    if (keys.length === 0) {
      activeKeysList.innerHTML = '<div class="text-xs font-mono text-gray-500">No active keys generated yet.</div>';
      return;
    }

    activeKeysList.innerHTML = keys
      .map(
        (k) => `
      <div class="clay-inset p-3 rounded-xl flex items-center justify-between text-xs font-mono">
        <div>
          <div class="text-white font-bold">${escapeHtml(k.name)} <span class="text-[10px] text-cyan-400 font-normal">[${k.permissions}]</span></div>
          <div class="text-[11px] text-gray-400 mt-0.5">${k.prefix}</div>
          <div class="text-[10px] text-gray-500">Created: ${new Date(k.created_at).toLocaleDateString()} ${k.last_used_at ? '• Active' : ''}</div>
        </div>
        <button class="revoke-key-btn clay-btn px-2.5 py-1 text-xs text-red-400 hover:text-red-300 font-mono" data-id="${k.id}">
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
        await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
        loadAdminKeys();
      });
    });
  } catch {}
}

createApiKeyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = newKeyNameInput.value.trim();
  const permissions = newKeyPermSelect.value;
  if (!name) return;

  try {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
// 7. INTERACTIVE API CHECKER
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
  } else if (endpoint === 'domains') {
    url = '/api/domains';
  }

  testerStatusCode.textContent = 'Connecting...';
  testerStatusCode.className = 'px-2 py-0.5 rounded font-bold bg-yellow-500/20 text-yellow-300';
  testerResponseBox.textContent = 'Transmitting request packet...';

  const t0 = performance.now();
  try {
    const res = await fetch(url, { method, headers, body });
    const t1 = performance.now();
    testerLatency.textContent = `${Math.round(t1 - t0)}ms`;

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
  } else if (endpoint === 'domains') {
    curl = `curl -X GET "${host}/api/domains"`;
  }

  if (apiKey && endpoint !== 'check-key') {
    curl += ` \\\n  -H "x-api-key: ${apiKey}"`;
  }

  navigator.clipboard.writeText(curl).then(() => {
    copyCurlBtn.textContent = '✓ Copied cURL!';
    setTimeout(() => {
      copyCurlBtn.textContent = 'Copy cURL';
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

// Boot
initApp();
