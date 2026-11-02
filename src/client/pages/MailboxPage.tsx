import React, { useState, useEffect, useRef } from 'react';
import { Mail, RefreshCw, Trash2, QrCode, Copy, Check, Sparkles, Plus, Clock, Snowflake, ShieldCheck, Zap, Download } from 'lucide-react';
import { UserProfile, UserMailbox, EmailMessage, DiscordVerification, DomainInfo } from '../types';

interface MailboxPageProps {
  user: UserProfile | null;
  soundEnabled: boolean;
  onPlayChime: () => void;
  initialAddress?: string;
  onAddressChange: (addr: string) => void;
}

export const MailboxPage: React.FC<MailboxPageProps> = ({
  user,
  soundEnabled,
  onPlayChime,
  initialAddress,
  onAddressChange,
}) => {
  const [currentAddress, setCurrentAddress] = useState<string>(initialAddress || '');
  const [domains, setDomains] = useState<string[]>(['rizzcord.site']);
  const [currentDomain, setCurrentDomain] = useState<string>('rizzcord.site');
  const [recentMailboxes, setRecentMailboxes] = useState<string[]>([]);
  const [userInboxes, setUserInboxes] = useState<UserMailbox[]>([]);
  const [showUserDrawer, setShowUserDrawer] = useState(false);
  const [showCustomDrawer, setShowCustomDrawer] = useState(false);
  const [customUsername, setCustomUsername] = useState('');
  const [pasteInput, setPasteInput] = useState('');

  // Messages state
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [messageViewTab, setMessageViewTab] = useState<'html' | 'text' | 'headers' | 'raw'>('html');
  const [feedSearch, setFeedSearch] = useState('');
  const [isPreserved, setIsPreserved] = useState(false);
  const [discordOtp, setDiscordOtp] = useState<DiscordVerification | null>(null);

  // Modals
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isOwner = Boolean(user?.user?.isOwner);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load Domains
  const fetchDomains = async () => {
    try {
      const res = await fetch('/domains');
      if (res.ok) {
        const data = await res.json();
        const list = data.domains || ['rizzcord.site'];
        setDomains(list);
        if (data.default) setCurrentDomain(data.default);
      }
    } catch {}
  };

  // Load User inboxes
  const fetchUserInboxes = async () => {
    if (!user?.loggedIn) return;
    try {
      const res = await fetch('/api/user/inboxes');
      if (res.ok) {
        const data = await res.json();
        setUserInboxes(data.mailboxes || []);
      }
    } catch {}
  };

  // Load Messages for current address
  const fetchMessages = async (addr: string) => {
    if (!addr) {
      setMessages([]);
      setSelectedMessage(null);
      return;
    }
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(addr)}`);
      if (res.ok) {
        const data = await res.json();
        const list: EmailMessage[] = data.messages || [];
        setMessages(list);
        if (list.length > 0 && !selectedMessage) {
          setSelectedMessage(list[0]);
        }
      }
    } catch {}

    // Check status
    try {
      const statusRes = await fetch(`/api/inbox/status/${encodeURIComponent(addr)}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIsPreserved(Boolean(statusData.is_preserved));
      }
    } catch {}

    // Check Discord OTP
    try {
      const discordRes = await fetch(`/api/discord/${encodeURIComponent(addr)}?wait=false`);
      if (discordRes.ok) {
        const dData = await discordRes.json();
        if (dData.found && dData.discord_code) {
          setDiscordOtp(dData);
        } else {
          setDiscordOtp(null);
        }
      } else {
        setDiscordOtp(null);
      }
    } catch {
      setDiscordOtp(null);
    }
  };

  useEffect(() => {
    fetchDomains();
    const savedRecent = localStorage.getItem('crown_recent_mailboxes');
    if (savedRecent) {
      try {
        setRecentMailboxes(JSON.parse(savedRecent));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (user?.loggedIn) {
      fetchUserInboxes();
    }
  }, [user]);

  useEffect(() => {
    if (currentAddress) {
      fetchMessages(currentAddress);
      // Save recent
      setRecentMailboxes((prev) => {
        const filtered = prev.filter((a) => a !== currentAddress && !a.includes('cyber'));
        const updated = [currentAddress, ...filtered].slice(0, 8);
        localStorage.setItem('crown_recent_mailboxes', JSON.stringify(updated));
        return updated;
      });
    }
  }, [currentAddress]);

  // QR Modal render
  useEffect(() => {
    if (showQrModal && qrCanvasRef.current && currentAddress && (window as any).QRCode) {
      (window as any).QRCode.toCanvas(qrCanvasRef.current, currentAddress, { width: 220, margin: 1 });
    }
  }, [showQrModal, currentAddress]);

  // Handlers
  const handleSelectAddress = (addr: string) => {
    let clean = (addr || '').toLowerCase().trim();
    if (!clean.includes('@')) {
      clean = `${clean}@${currentDomain}`;
    }
    setCurrentAddress(clean);
    onAddressChange(clean);
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteInput.trim()) return;
    handleSelectAddress(pasteInput.trim());
    setPasteInput('');
  };

  const handleRandomMail = async () => {
    if (!user?.loggedIn) {
      window.location.href = '/api/auth/discord/login';
      return;
    }

    // Generate random proper dictionary name
    const adjectives = ['vortex', 'phantom', 'shadow', 'blaze', 'crwn', 'zenith', 'pulse', 'mystic', 'glacier', 'silver'];
    const nouns = ['vault', 'mail', 'node', 'falcon', 'titan', 'stream', 'sentinel', 'matrix', 'echo', 'frost'];
    const randomName = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${Math.floor(Math.random() * 89 + 10)}`;
    const fullAddr = `${randomName}@${currentDomain}`;

    try {
      const res = await fetch('/api/inbox/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: fullAddr }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleSelectAddress(fullAddr);
        fetchUserInboxes();
      } else {
        alert(data.error || 'Failed to create mailbox.');
      }
    } catch {
      alert('Network error while creating mailbox.');
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.loggedIn) {
      window.location.href = '/api/auth/discord/login';
      return;
    }
    const cleanUser = customUsername.trim().toLowerCase().replace(/cyber[-_]?/gi, '');
    if (!cleanUser) return;
    const fullAddr = `${cleanUser}@${currentDomain}`;

    try {
      const res = await fetch('/api/inbox/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: fullAddr }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        handleSelectAddress(fullAddr);
        setCustomUsername('');
        setShowCustomDrawer(false);
        fetchUserInboxes();
      } else {
        alert(data.error || 'Failed to create mailbox.');
      }
    } catch {
      alert('Network error while creating custom mailbox.');
    }
  };

  const handleDeleteUserMailbox = async (addr: string) => {
    if (!confirm(`Delete mailbox "${addr}"?\n\nThis will permanently delete this mailbox and all emails, immediately freeing 1 slot in your 3-mailbox quota.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/user/mailboxes/${encodeURIComponent(addr)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (currentAddress === addr) {
          setCurrentAddress('');
          onAddressChange('');
        }
        await fetchUserInboxes();
      } else {
        alert(data.error || 'Failed to delete mailbox');
      }
    } catch {
      alert('Network error while deleting mailbox');
    }
  };

  const handleClearInbox = async () => {
    if (!currentAddress) {
      alert('No mailbox is currently active.');
      return;
    }
    if (!confirm(`Purge all emails in ${currentAddress}?`)) return;
    try {
      await fetch(`/api/inbox/${encodeURIComponent(currentAddress)}`, { method: 'DELETE' });
      fetchMessages(currentAddress);
    } catch {}
  };

  const filteredMessages = messages.filter((m) => {
    const q = feedSearch.toLowerCase();
    return m.subject?.toLowerCase().includes(q) || m.from_address?.toLowerCase().includes(q) || m.from_name?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">
      {/* 1. OMNIBAR & ACCESS DECK */}
      <div className="clay-plate p-4 sm:p-5 relative border border-cyan-500/20">
        {/* Discord Notice if unauthenticated */}
        {!user?.loggedIn && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-3 text-xs font-mono text-purple-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Discord Login required to generate new mailboxes (Limit: 3 active mailboxes). You can still paste any existing inbox.</span>
            </div>
            <a href="/api/auth/discord/login" className="clay-btn-discord px-3 py-1 text-[11px] shrink-0">
              Login Now
            </a>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Paste Form */}
          <form onSubmit={handlePasteSubmit} className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 clay-inset flex items-center px-4 py-2.5 border border-white/5">
              <Mail className="w-4 h-4 text-cyan-400 mr-3 shrink-0" />
              <input
                type="text"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="Paste any address to open or restore preserved vault (e.g. liam46@rizzcord.site)"
                className="w-full bg-transparent text-sm font-mono text-white placeholder-gray-500 outline-none"
              />
            </div>
            <button type="submit" className="clay-btn-primary px-5 py-2.5 text-xs font-mono font-bold flex items-center justify-center gap-2 shrink-0">
              <Zap className="w-4 h-4 text-black" />
              <span>OPEN / RESTORE</span>
            </button>
          </form>

          {/* Creation Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRandomMail}
              className="clay-btn px-4 py-2.5 text-xs font-mono font-bold text-gray-200 gap-2 hover:text-white"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Random Mail</span>
            </button>

            <button
              onClick={() => {
                if (!user?.loggedIn) {
                  window.location.href = '/api/auth/discord/login';
                  return;
                }
                setShowCustomDrawer(!showCustomDrawer);
              }}
              className="clay-btn px-3 py-2.5 text-xs font-mono text-gray-300 hover:text-white gap-1.5"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Custom</span>
            </button>
          </div>
        </div>

        {/* Custom Mailbox Drawer */}
        {showCustomDrawer && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <form onSubmit={handleCustomSubmit} className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-mono text-gray-400">Custom Mailbox:</span>
              <div className="clay-inset px-3 py-1.5 flex items-center gap-1">
                <input
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder="e.g. phantom, vortex"
                  className="bg-transparent text-xs font-mono text-white outline-none w-44 sm:w-56"
                  required
                />
                <span className="text-gray-500 text-xs font-mono">@</span>
                <select
                  value={currentDomain}
                  onChange={(e) => setCurrentDomain(e.target.value)}
                  className="bg-transparent text-xs font-mono text-cyan-300 outline-none cursor-pointer"
                >
                  {domains.map((d) => (
                    <option key={d} value={d} className="bg-vault-900 text-white">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="clay-btn px-3.5 py-1.5 text-xs font-mono text-emerald-400 font-bold hover:border-emerald-500/40">
                Create Mailbox
              </button>
            </form>
          </div>
        )}

        {/* Recent & User Inboxes Ribbon */}
        <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Recent:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {recentMailboxes.map((addr) => (
                <button
                  key={addr}
                  onClick={() => handleSelectAddress(addr)}
                  className="clay-pill px-2 py-0.5 text-[11px] font-mono text-cyan-300 hover:text-white"
                >
                  {addr}
                </button>
              ))}
              {recentMailboxes.length === 0 && <span className="text-[11px] font-mono text-gray-600">None yet</span>}
            </div>
          </div>

          {user?.loggedIn && (
            <button
              onClick={() => setShowUserDrawer(!showUserDrawer)}
              className="text-[11px] font-mono text-cyan-400 hover:underline flex items-center gap-1"
            >
              <span>My Discord Inboxes</span>
              <span className="clay-badge px-1.5 text-[10px]">{userInboxes.length}</span>
            </button>
          )}
        </div>

        {/* User Inboxes Drawer with 3-Mailbox Quota */}
        {showUserDrawer && (
          <div className="mt-3 p-3.5 clay-inset rounded-2xl space-y-2.5 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <span>Your Discord Created Mailboxes</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isOwner
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      : userInboxes.length >= 3
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {isOwner ? `${userInboxes.length} / Unlimited (Owner)` : `${userInboxes.length} / 3 Active`}
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                {isOwner ? 'Unlimited Owner Access' : 'Standard limit: 3 mailboxes (Delete to free slot)'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {userInboxes.map((m) => (
                <div key={m.address} className="clay-pill px-2.5 py-1 text-xs font-mono flex items-center gap-2 border border-white/5 bg-vault-900/60">
                  <button
                    onClick={() => handleSelectAddress(m.address)}
                    className="text-cyan-300 hover:text-white flex items-center gap-1.5"
                    title="Open Mailbox"
                  >
                    <span>📬</span>
                    <span className="font-bold">{m.address}</span>
                    {m.is_preserved && <span className="text-[9px] text-cyan-400 font-bold" title="Cold Storage">❄️</span>}
                    <span className="text-[10px] text-gray-400">({m.count})</span>
                  </button>
                  <button
                    onClick={() => handleDeleteUserMailbox(m.address)}
                    className="text-gray-500 hover:text-rose-400 p-0.5 rounded transition-all"
                    title="Delete Mailbox (Frees 1 Quota Slot)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {userInboxes.length === 0 && (
                <span className="text-xs text-gray-500 font-mono">No mailboxes created under your Discord account yet.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. COLD PRESERVATION BANNER (>24h preserved) */}
      {isPreserved && (
        <div className="clay-plate p-4 sm:p-5 border border-cyan-500/30 bg-cyan-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <Snowflake className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">Cold Preservation Vault Active</h3>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  &gt;24h Preserved State
                </span>
              </div>
              <p className="text-xs text-gray-300 font-mono mt-0.5">
                This inbox is in cold storage. Email bodies are compressed to minimize disk usage with ZERO deletions!
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/60 px-3 py-1.5 rounded-xl border border-cyan-500/30">
            🛡️ ZERO EMAILS EXPIRED
          </span>
        </div>
      )}

      {/* 3. ACTIVE MAILBOX HUB */}
      <div className="clay-plate p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase font-bold tracking-wider">
              Active Mailbox
            </span>
            <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Infinite SQLite Vault Active</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`font-mono font-bold tracking-tight ${currentAddress ? 'text-lg sm:text-xl text-white select-all' : 'text-base sm:text-lg text-gray-500 italic'}`}>
              {currentAddress || 'No Mailbox Active'}
            </span>

            {currentAddress && (
              <>
                <button
                  onClick={() => copyToClipboard(currentAddress, 'copy-addr')}
                  className="clay-btn px-2.5 py-1 text-xs font-mono text-gray-300 hover:text-cyan-400 gap-1"
                >
                  {copiedKey === 'copy-addr' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'copy-addr' ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => setShowQrModal(true)}
                  className="clay-btn px-2.5 py-1 text-xs font-mono text-gray-300 hover:text-purple-400 gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QR</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Action Controls: Domain, Sync, Clear, Delete Mailbox */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="clay-inset px-2.5 py-1 flex items-center gap-1.5 text-xs font-mono">
            <span className="text-gray-500">Domain:</span>
            <select
              value={currentDomain}
              onChange={(e) => {
                setCurrentDomain(e.target.value);
                if (currentAddress) {
                  const parts = currentAddress.split('@');
                  handleSelectAddress(`${parts[0]}@${e.target.value}`);
                }
              }}
              className="bg-transparent text-cyan-300 outline-none cursor-pointer"
            >
              {domains.map((d) => (
                <option key={d} value={d} className="bg-vault-900 text-white">
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => currentAddress && fetchMessages(currentAddress)}
            disabled={!currentAddress}
            className="clay-btn px-3 py-1.5 text-xs font-mono text-gray-300 hover:text-white gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>

          <button
            onClick={handleClearInbox}
            disabled={!currentAddress}
            className="clay-btn px-3 py-1.5 text-xs font-mono text-red-400 hover:text-red-300 hover:border-red-500/30 gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          {currentAddress && (
            <button
              onClick={() => handleDeleteUserMailbox(currentAddress)}
              className="clay-btn px-3 py-1.5 text-xs font-mono text-rose-400 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/40 gap-1"
              title="Delete Mailbox (Frees 1 slot in your 3-mailbox quota)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Mailbox</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. DISCORD VERIFICATION OTP BANNER */}
      {discordOtp?.discord_code && (
        <div className="clay-plate p-4 sm:p-5 discord-otp-glow relative overflow-hidden bg-purple-950/20 border border-purple-500/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/40 shrink-0">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 font-bold">
                  Discord Verification Detected
                </span>
                <div className="text-xl sm:text-2xl font-mono font-black tracking-widest text-white mt-0.5">
                  {discordOtp.discord_code}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(discordOtp.discord_code || '', 'otp')}
                className="clay-btn-discord px-4 py-2 text-xs font-mono font-bold flex items-center gap-1.5"
              >
                {copiedKey === 'otp' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'otp' ? 'Copied Code!' : 'Copy Code'}</span>
              </button>

              {discordOtp.discord_url && (
                <a
                  href={discordOtp.discord_url}
                  target="_blank"
                  rel="noreferrer"
                  className="clay-btn px-4 py-2 text-xs font-mono text-purple-300 hover:text-white"
                >
                  Click Verify Link
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. INBOUND FEED & MESSAGE VIEWER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Messages List */}
        <div className="lg:col-span-5 clay-plate p-4 space-y-3 flex flex-col h-[650px] border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">Inbound Feed</h3>
              <span className="clay-badge px-2 py-0.5 text-xs text-cyan-300 font-mono font-bold">
                {filteredMessages.length}
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Live Vault</span>
            </span>
          </div>

          <div className="clay-inset px-3 py-1.5 flex items-center gap-2">
            <input
              type="text"
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              placeholder="Search sender or subject..."
              className="bg-transparent text-xs font-mono text-white outline-none w-full"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                  selectedMessage?.id === msg.id
                    ? 'bg-cyan-950/40 border-cyan-500/40 shadow-sm'
                    : 'clay-card border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                  <span className="text-cyan-300 font-bold truncate max-w-[160px]">{msg.from_name || msg.from_address}</span>
                  <span>{new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-xs font-mono font-bold text-white truncate">{msg.subject || '(No Subject)'}</div>
                <div className="text-[11px] font-mono text-gray-500 truncate mt-1">
                  {msg.text_body?.slice(0, 70) || '(Empty Body)'}
                </div>
              </div>
            ))}

            {filteredMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2">
                <Mail className="w-10 h-10 stroke-1" />
                <p className="text-xs font-mono">No emails received yet for this address.</p>
                <p className="text-[11px] font-mono text-gray-600">Send an email to {currentAddress || 'this mailbox'} to see it appear live.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Full Message Reader */}
        <div className="lg:col-span-7 clay-plate p-5 space-y-4 flex flex-col h-[650px] border border-white/5">
          {selectedMessage ? (
            <>
              {/* Header */}
              <div className="border-b border-white/5 pb-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-mono font-bold text-white truncate max-w-md">
                    {selectedMessage.subject || '(No Subject)'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">
                      {new Date(selectedMessage.received_at).toLocaleString()}
                    </span>
                    <button
                      onClick={async () => {
                        if (!confirm('Delete this email?')) return;
                        await fetch(`/api/messages/${encodeURIComponent(currentAddress)}/${selectedMessage.id}`, { method: 'DELETE' });
                        fetchMessages(currentAddress);
                        setSelectedMessage(null);
                      }}
                      className="text-gray-500 hover:text-rose-400 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-mono text-gray-400">
                  <span>From: </span>
                  <span className="text-cyan-300 font-bold">{selectedMessage.from_name || selectedMessage.from_address}</span>
                  <span className="text-gray-500"> &lt;{selectedMessage.from_address}&gt;</span>
                </div>
              </div>

              {/* Viewer Tabs */}
              <div className="flex items-center gap-1 clay-pill p-1 border border-white/5 bg-vault-950/40 w-fit">
                <button
                  onClick={() => setMessageViewTab('html')}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-xl ${
                    messageViewTab === 'html' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  HTML View
                </button>
                <button
                  onClick={() => setMessageViewTab('text')}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-xl ${
                    messageViewTab === 'text' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Plain Text
                </button>
                <button
                  onClick={() => setMessageViewTab('raw')}
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-xl ${
                    messageViewTab === 'raw' ? 'bg-cyan-500/20 text-cyan-300' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Raw EML
                </button>
              </div>

              {/* View Content */}
              <div className="flex-1 clay-inset p-4 overflow-auto rounded-2xl">
                {messageViewTab === 'html' && (
                  selectedMessage.html_body ? (
                    <iframe
                      srcDoc={selectedMessage.html_body}
                      title="Email Content"
                      sandbox="allow-popups allow-same-origin"
                      className="w-full h-full border-none bg-white rounded-xl text-black"
                    />
                  ) : (
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap select-all">
                      {selectedMessage.text_body || '(No text content)'}
                    </pre>
                  )
                )}

                {messageViewTab === 'text' && (
                  <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap select-all">
                    {selectedMessage.text_body || '(No text content)'}
                  </pre>
                )}

                {messageViewTab === 'raw' && (
                  <pre className="text-xs font-mono text-cyan-300 whitespace-pre-wrap select-all">
                    {selectedMessage.raw_eml || 'Raw EML not available'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500 space-y-2">
              <Mail className="w-12 h-12 stroke-1" />
              <p className="text-xs font-mono text-gray-400">Select an email from the left feed to read</p>
            </div>
          )}
        </div>
      </div>

      {/* QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 clay-backdrop flex items-center justify-center p-4">
          <div className="clay-plate w-full max-w-sm rounded-3xl p-6 text-center space-y-4 border border-cyan-500/30">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-mono font-bold text-white">Mobile Scan QR</h3>
              <button onClick={() => setShowQrModal(false)} className="text-gray-400 hover:text-white text-lg font-mono">
                ✕
              </button>
            </div>
            <div className="flex justify-center p-3 clay-inset rounded-2xl bg-white">
              <canvas ref={qrCanvasRef} />
            </div>
            <div className="text-xs font-mono text-cyan-300 select-all break-all">{currentAddress}</div>
          </div>
        </div>
      )}
    </div>
  );
};
