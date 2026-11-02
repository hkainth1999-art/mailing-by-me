import React, { useState, useEffect } from 'react';
import { Shield, Globe, Key, Database, Lock, Copy, Check, Trash2, Plus, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { DomainInfo, SystemStats } from '../types';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'domains' | 'stats' | 'keys' | 'security'>('domains');
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  // Domain add form
  const [newDomain, setNewDomain] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [addingDomain, setAddingDomain] = useState(false);

  // Key form
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Expanded DNS cards
  const [expandedDns, setExpandedDns] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [preserveStatus, setPreserveStatus] = useState<string | null>(null);

  const primaryMailHost = 'mail.rizzcord.site';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleDnsCard = (domain: string) => {
    setExpandedDns((prev) => ({
      ...prev,
      [domain]: !prev[domain],
    }));
  };

  const fetchDomains = async () => {
    try {
      const res = await fetch('/api/admin/domains');
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
      }
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/admin/keys');
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchDomains();
    fetchStats();
    fetchKeys();
  }, []);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim().toLowerCase(), isDefault }),
      });
      const data = await res.json();
      if (data.success) {
        const added = newDomain.trim().toLowerCase();
        setNewDomain('');
        setIsDefault(false);
        await fetchDomains();
        // Automatically expand the DNS card for the new domain!
        setExpandedDns((prev) => ({ ...prev, [added]: true }));
      } else {
        alert(data.error || 'Failed to add domain');
      }
    } catch {
      alert('Network error while adding domain');
    } finally {
      setAddingDomain(false);
    }
  };

  const handleSetDefaultDomain = async (domain: string) => {
    try {
      await fetch(`/api/admin/domains/${encodeURIComponent(domain)}/default`, { method: 'PUT' });
      await fetchDomains();
    } catch {}
  };

  const handleDeleteDomain = async (domain: string) => {
    if (!confirm(`Remove domain "${domain}" from SMTP server?`)) return;
    try {
      const res = await fetch(`/api/admin/domains/${encodeURIComponent(domain)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        await fetchDomains();
      }
    } catch {}
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyLabel.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedKey(data.apiKey);
        setNewKeyLabel('');
        await fetchKeys();
      } else {
        alert(data.error || 'Failed to generate key');
      }
    } catch {}
  };

  const handleRevokeKey = async (id: string | number) => {
    if (!confirm('Revoke this API Key?')) return;
    try {
      await fetch(`/api/admin/keys/${id}`, { method: 'DELETE' });
      await fetchKeys();
    } catch {}
  };

  const handleTriggerPreservation = async () => {
    try {
      const res = await fetch('/api/admin/preserve', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPreserveStatus('Preservation pass completed. Old messages compressed!');
        await fetchStats();
        setTimeout(() => setPreserveStatus(null), 4000);
      }
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="clay-plate p-6 border border-amber-500/30 relative overflow-hidden bg-amber-950/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/20">
              <Shield className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-mono font-bold text-white">Crown Admin Vault & Domain Control</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  OWNER ACCESS
                </span>
              </div>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Zero credentials leaked • Inbound Port 25 SMTP Gateway • Multi-Domain DNS Automation
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pt-5 border-t border-white/5 mt-4">
          <button
            onClick={() => setActiveTab('domains')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'domains'
                ? 'clay-pill text-amber-300 border-amber-500/40 shadow-sm'
                : 'clay-btn text-gray-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Multi-Domains ({domains.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'stats'
                ? 'clay-pill text-amber-300 border-amber-500/40 shadow-sm'
                : 'clay-btn text-gray-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cold Vault & Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'keys'
                ? 'clay-pill text-amber-300 border-amber-500/40 shadow-sm'
                : 'clay-btn text-gray-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-xl flex items-center gap-2 transition-all ${
              activeTab === 'security'
                ? 'clay-pill text-amber-300 border-amber-500/40 shadow-sm'
                : 'clay-btn text-gray-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security & Health</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MULTI-DOMAINS & INTERACTIVE DNS HELPERS */}
      {activeTab === 'domains' && (
        <div className="space-y-5">
          {/* Add Domain Form */}
          <div className="clay-plate p-5 border border-cyan-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Add Inbound Domain to SMTP & Web Vault</span>
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">Instantly Active on Port 25</span>
            </div>

            <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="e.g. siliconhost.info or temp.mysite.com"
                className="flex-1 bg-transparent border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-cyan-400"
                required
              />
              <label className="flex items-center gap-2 text-xs font-mono text-gray-300 px-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded bg-black border-gray-600 text-cyan-500"
                />
                <span>Set as Default</span>
              </label>
              <button
                type="submit"
                disabled={addingDomain}
                className="clay-btn-primary px-5 py-2.5 text-xs font-mono font-bold text-black shrink-0"
              >
                {addingDomain ? 'Adding...' : 'Add Domain'}
              </button>
            </form>

            {/* General Multi-Domain Explanation Card */}
            <div className="p-3.5 rounded-xl bg-black/50 border border-cyan-500/20 text-xs font-mono space-y-2 text-gray-300">
              <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                <span>📋</span> <span>Cloudflare DNS Guide for Connected Domains:</span>
              </div>
              <div className="text-[11px] space-y-1 text-gray-400">
                <div>• <strong className="text-white">Host (Name):</strong> <code className="text-cyan-300">@</code></div>
                <div>• <strong className="text-white">Type:</strong> <code className="text-cyan-300">MX</code></div>
                <div>• <strong className="text-white">Priority:</strong> <code className="text-cyan-300">10</code></div>
                <div>• <strong className="text-white">Mail Server (Target):</strong> <code className="text-cyan-300 font-bold">{primaryMailHost}</code> <span className="text-emerald-400 text-[10px]">(Do NOT create mail.domain — point all domains to {primaryMailHost}!)</span></div>
                <div>• <strong className="text-white">SPF (TXT):</strong> <code className="text-purple-300">v=spf1 mx ~all</code></div>
              </div>
            </div>
          </div>

          {/* Active Domains List */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
              Configured Active Domains ({domains.length})
            </h4>

            {domains.map((d) => {
              const isExpanded = Boolean(expandedDns[d.domain]);

              return (
                <div key={d.domain} className="clay-plate p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div
                      className="flex items-center gap-2.5 cursor-pointer"
                      onClick={() => toggleDnsCard(d.domain)}
                    >
                      <span className="text-base">🌐</span>
                      <span className="text-white font-bold text-sm hover:text-cyan-300 transition-colors">
                        {d.domain}
                      </span>
                      {d.is_default && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                          DEFAULT
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleDnsCard(d.domain)}
                        className="clay-btn px-2.5 py-1 text-[11px] text-cyan-300 hover:text-white flex items-center gap-1"
                      >
                        <span>📋</span>
                        <span>DNS Records</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
                      </button>

                      {!d.is_default && (
                        <button
                          onClick={() => handleSetDefaultDomain(d.domain)}
                          className="clay-btn px-2.5 py-1 text-[11px] text-gray-300 hover:text-white"
                        >
                          Set Default
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteDomain(d.domain)}
                        className="clay-btn px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 hover:border-rose-500/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Expandable DNS Helper Card */}
                  {isExpanded && (
                    <div className="p-4 rounded-xl bg-black/70 border border-cyan-500/30 space-y-3.5 text-xs">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                          <span>📋</span>
                          <span>Cloudflare DNS Setup for <strong className="text-white underline">{d.domain}</strong></span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                          SMTP Inbound Ready
                        </span>
                      </div>

                      {/* Direct Answer to User's Question */}
                      <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-[11px] text-gray-300 space-y-1.5">
                        <div className="text-white font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-cyan-400" />
                          <span>Do you need to create <code>mail.{d.domain}</code>?</span>
                        </div>
                        <div className="text-gray-300">
                          <strong className="text-emerald-300">NO, you do NOT need to create a new mail subdomain!</strong> Because your inbound mail server is already listening on your server at <code className="text-cyan-300 font-bold">{primaryMailHost}</code>, simply set <span className="text-white font-bold">{d.domain}</span>'s MX record to <code className="text-cyan-300 font-bold">{primaryMailHost}</code>! All emails sent to <code className="text-white">user@{d.domain}</code> will be routed straight to your vault.
                        </div>
                      </div>

                      {/* Records Table */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Required Records (Add in Cloudflare DNS for {d.domain}):
                        </div>

                        {/* Record 1: MX */}
                        <div className="p-3 rounded-xl bg-vault-950 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                MX
                              </span>
                              <span className="text-gray-400">Name:</span> <code className="text-white font-bold">@</code>
                              <span className="text-gray-400">Priority:</span> <code className="text-white font-bold">10</code>
                            </div>
                            <div>
                              <span className="text-gray-400">Mail Server / Target:</span>{' '}
                              <code className="text-cyan-300 font-bold">{primaryMailHost}</code>
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(primaryMailHost, `mx-${d.domain}`)}
                            className="clay-btn px-3 py-1.5 text-[10px] text-gray-300 hover:text-white shrink-0 self-start sm:self-auto flex items-center gap-1"
                          >
                            {copiedKey === `mx-${d.domain}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `mx-${d.domain}` ? 'Copied' : 'Copy Target'}</span>
                          </button>
                        </div>

                        {/* Record 2: SPF */}
                        <div className="p-3 rounded-xl bg-vault-950 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px]">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                TXT (SPF)
                              </span>
                              <span className="text-gray-400">Name:</span> <code className="text-white font-bold">@</code>
                            </div>
                            <div>
                              <span className="text-gray-400">Content:</span>{' '}
                              <code className="text-purple-300 font-bold">v=spf1 mx ~all</code>
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard('v=spf1 mx ~all', `spf-${d.domain}`)}
                            className="clay-btn px-3 py-1.5 text-[10px] text-gray-300 hover:text-white shrink-0 self-start sm:self-auto flex items-center gap-1"
                          >
                            {copiedKey === `spf-${d.domain}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `spf-${d.domain}` ? 'Copied' : 'Copy Content'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional Custom Subdomain Accordion */}
                      <details className="text-[11px] text-gray-400 cursor-pointer pt-1">
                        <summary className="hover:text-cyan-300 transition-colors">
                          Want custom <code>mail.{d.domain}</code> branding instead? (Click to view)
                        </summary>
                        <div className="mt-2 p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1.5 text-[11px]">
                          <p className="text-gray-300">If you prefer custom branding for this domain, add these 2 records in Cloudflare:</p>
                          <div>1. <strong>A Record:</strong> Name: <code className="text-cyan-300">mail</code> | Content: <code className="text-white">Your VPS IP</code> | Proxy: <strong className="text-rose-400">DNS ONLY (Grey Cloud)</strong></div>
                          <div>2. <strong>MX Record:</strong> Name: <code className="text-cyan-300">@</code> | Mail Server: <code className="text-cyan-300">mail.{d.domain}</code> | Priority: <code className="text-white">10</code></div>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COLD VAULT & METRICS */}
      {activeTab === 'stats' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="clay-plate p-4 text-center space-y-1 border border-white/5">
              <div className="text-2xl font-mono font-bold text-white">{stats?.mailboxes ?? 0}</div>
              <div className="text-[11px] font-mono text-gray-400">Total Inboxes</div>
            </div>
            <div className="clay-plate p-4 text-center space-y-1 border border-cyan-500/20">
              <div className="text-2xl font-mono font-bold text-cyan-400">{stats?.preserved_mailboxes ?? 0}</div>
              <div className="text-[11px] font-mono text-gray-400">Preserved Inboxes (&gt;24h)</div>
            </div>
            <div className="clay-plate p-4 text-center space-y-1 border border-emerald-500/20">
              <div className="text-2xl font-mono font-bold text-emerald-400">{stats?.messages ?? 0}</div>
              <div className="text-[11px] font-mono text-gray-400">Total Saved Emails</div>
            </div>
            <div className="clay-plate p-4 text-center space-y-1 border border-purple-500/20">
              <div className="text-2xl font-mono font-bold text-purple-400">{stats?.compressed_messages ?? 0}</div>
              <div className="text-[11px] font-mono text-gray-400">Compressed Space-Savers</div>
            </div>
          </div>

          <div className="clay-plate p-5 space-y-3 border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-mono font-bold text-white">Cold Preservation & Zero-Deletion Pass</h4>
                <p className="text-xs font-mono text-gray-400">Compresses emails older than 24h into gzip/deflate blobs to minimize disk storage.</p>
              </div>
              <button
                onClick={handleTriggerPreservation}
                className="clay-btn px-4 py-2 text-xs font-mono text-cyan-300 hover:text-white shrink-0"
              >
                Run Compression Pass Now
              </button>
            </div>
            {preserveStatus && (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                {preserveStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-5">
          <div className="clay-plate p-5 space-y-4 border border-cyan-500/20">
            <h3 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
              Generate Cryptographic API Key
            </h3>

            <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="Key label (e.g. Discord Bot / Python Automation)"
                className="flex-1 bg-transparent border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-cyan-400"
                required
              />
              <button
                type="submit"
                className="clay-btn-primary px-5 py-2.5 text-xs font-mono font-bold text-black shrink-0"
              >
                Generate Key
              </button>
            </form>

            {generatedKey && (
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-400/40 space-y-2">
                <div className="text-[11px] font-mono text-cyan-300 font-bold">
                  ⚠️ Save this key now! It will not be shown again:
                </div>
                <div className="clay-inset p-2.5 rounded-lg text-xs font-mono text-white select-all flex items-center justify-between gap-2 overflow-x-auto">
                  <span>{generatedKey}</span>
                  <button
                    onClick={() => copyToClipboard(generatedKey, 'gen-key')}
                    className="clay-btn px-2.5 py-1 text-[11px] text-cyan-300 shrink-0"
                  >
                    {copiedKey === 'gen-key' ? 'Copied' : 'Copy Key'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
              Active API Keys ({apiKeys.length})
            </h4>
            {apiKeys.map((k) => (
              <div key={k.id} className="clay-plate p-3.5 border border-white/5 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="text-white font-bold">{k.name}</div>
                  <div className="text-[10px] text-gray-500">Key Prefix: {k.key_prefix}... • Created: {new Date(k.created_at).toLocaleDateString()}</div>
                </div>
                <button
                  onClick={() => handleRevokeKey(k.id)}
                  className="clay-btn px-2.5 py-1 text-rose-400 hover:text-rose-300 text-[11px]"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY & HEALTH */}
      {activeTab === 'security' && (
        <div className="clay-plate p-6 border border-white/5 space-y-4 text-xs font-mono">
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">Security & System Health</h3>
          <div className="space-y-2 text-gray-300">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <span>Port 25 SMTP Gateway</span>
              <span className="text-emerald-400 font-bold">● Active & Isolated</span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <span>Database Engine</span>
              <span className="text-cyan-400 font-bold">SQLite 3 (WAL Mode Enabled)</span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <span>IP Masking</span>
              <span className="text-emerald-400 font-bold">● Active (Zero IP Leaks in Headers)</span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
              <span>Sliding Window Rate Limiting</span>
              <span className="text-emerald-400 font-bold">● Active (120 req/min, 12 mailboxes/10m)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
