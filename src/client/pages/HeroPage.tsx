import React, { useState, useEffect } from 'react';
import { UserProfile, SystemStats } from '../types';
import { CrownLogo, ColdVaultIcon, Port25Icon, ShieldLockIcon, DiscordLogo, MultiDomainIcon } from '../components/CustomIcons';
import { Mail, Sparkles, Terminal, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

interface HeroPageProps {
  user: UserProfile | null;
  onGoToMailbox: (address?: string) => void;
  onGoToDocs: () => void;
}

export const HeroPage: React.FC<HeroPageProps> = ({ user, onGoToMailbox, onGoToDocs }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [domains, setDomains] = useState<string[]>(['rizzcord.site']);
  const [quickInput, setQuickInput] = useState('');

  useEffect(() => {
    fetch('/domains')
      .then((r) => r.json())
      .then((d) => {
        if (d.domains) setDomains(d.domains);
      })
      .catch(() => {});

    fetch('/api/stats')
      .then((r) => r.json())
      .then((s) => setStats(s))
      .catch(() => {});
  }, []);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) {
      onGoToMailbox();
      return;
    }
    let addr = quickInput.trim().toLowerCase();
    if (!addr.includes('@')) {
      addr = `${addr}@${domains[0] || 'rizzcord.site'}`;
    }
    onGoToMailbox(addr);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden clay-plate p-8 sm:p-12 md:p-16 border border-white/5 text-center flex flex-col items-center">
        {/* Ambient Backlight Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <span className="clay-pill px-3 py-1 text-[11px] font-mono text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm">
            <Port25Icon className="w-3.5 h-3.5" />
            <span>PORT 25 SMTP GATEWAY</span>
          </span>
          <span className="clay-pill px-3 py-1 text-[11px] font-mono text-purple-300 border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
            <ColdVaultIcon className="w-3.5 h-3.5" />
            <span>24H COLD PRESERVATION</span>
          </span>
          <span className="clay-pill px-3 py-1 text-[11px] font-mono text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
            <ShieldLockIcon className="w-3.5 h-3.5" />
            <span>ZERO IP LEAKS</span>
          </span>
        </div>

        {/* Crown Crest */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-purple-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-purple-600/30 mb-6 p-0.5">
          <div className="w-full h-full bg-[#0a0d16] rounded-3xl flex items-center justify-center">
            <CrownLogo className="w-12 h-12 text-cyan-300" />
          </div>
        </div>

        {/* Main Headings */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight">
          CROWN <span className="text-cyan-400">MAIL VAULT</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base md:text-lg text-gray-300 font-medium max-w-2xl leading-relaxed">
          High-performance private temporary email architecture with direct inbound Port 25 SMTP reception, automated Discord verification link extraction, and infinite cold preservation.
        </p>

        {/* Primary Call-to-Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 w-full max-w-md">
          <button
            onClick={() => onGoToMailbox()}
            className="clay-btn-primary flex-1 py-3 px-6 text-sm font-mono font-bold text-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-transform"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Mailbox</span>
          </button>

          {!user?.loggedIn ? (
            <a
              href="/api/auth/discord/login"
              className="clay-btn-discord flex-1 py-3 px-6 text-sm font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 hover:scale-[1.02] transition-transform"
            >
              <DiscordLogo className="w-4 h-4" />
              <span>Login with Discord</span>
            </a>
          ) : (
            <button
              onClick={() => onGoToMailbox()}
              className="clay-btn py-3 px-6 text-sm font-mono text-cyan-300 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Logged In: {user.user?.username}</span>
            </button>
          )}

          <button
            onClick={onGoToDocs}
            className="clay-btn w-full sm:w-auto py-3 px-6 text-sm font-mono text-gray-300 hover:text-white flex items-center justify-center gap-2"
          >
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>API Docs & Testing</span>
          </button>
        </div>

        {/* Quick Access Omnibar */}
        <form onSubmit={handleQuickSubmit} className="mt-10 w-full max-w-xl">
          <div className="clay-plate p-1.5 flex items-center gap-2 border border-cyan-500/20 bg-black/40">
            <div className="pl-3 text-gray-400">
              <Mail className="w-4 h-4 text-cyan-400" />
            </div>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder={`Enter custom name or paste any existing mailbox...`}
              className="flex-1 bg-transparent border-none text-xs sm:text-sm font-mono text-white outline-none px-2 placeholder-gray-500"
            />
            <button
              type="submit"
              className="clay-btn px-4 py-2 text-xs font-mono font-bold text-cyan-300 hover:text-white flex items-center gap-1 shrink-0"
            >
              <span>Open Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] font-mono text-gray-500 mt-2">
            Active Domains: {domains.map((d) => `@${d}`).join(', ')}
          </p>
        </form>
      </section>

      {/* CORE CAPABILITIES GRID */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
            Engine Architecture
          </h2>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Built for Privacy, Speed & Zero Middlemen
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Feature 1 */}
          <div className="clay-card p-6 border border-white/5 space-y-3 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Port25Icon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
              Port 25 SMTP Gateway
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Inbound emails are accepted straight from remote mail exchanges into SQLite in under 5ms. Zero third-party webhooks, relays, or log leaks.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="clay-card p-6 border border-white/5 space-y-3 relative overflow-hidden group hover:border-purple-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <ColdVaultIcon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
              24h Cold Preservation
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Zero email deletions. Inboxes older than 24 hours are safely compressed into cold storage. Paste the mailbox at any time to instantly restore it.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="clay-card p-6 border border-white/5 space-y-3 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <DiscordLogo className="w-6 h-6 text-indigo-400" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
              Discord Verification API
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Specialized regex engine auto-detects Discord verification emails, parses the exact 1-click tokenized verify link and 6-digit OTP codes via REST API.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="clay-card p-6 border border-white/5 space-y-3 relative overflow-hidden group hover:border-amber-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <MultiDomainIcon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
              Dynamic Multi-Domain Mesh
            </h4>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Add any number of domains inside the Admin Vault. All connected domains simply point their MX record to <code className="text-cyan-300">mail.rizzcord.site</code>.
            </p>
          </div>
        </div>
      </section>

      {/* LIVE STATS BANNER */}
      {stats && (
        <section className="clay-plate p-6 border border-white/5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">{stats.mailboxes}</div>
              <div className="text-[11px] font-mono text-gray-400 mt-1 uppercase">Active Inboxes</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">{stats.preserved_mailboxes}</div>
              <div className="text-[11px] font-mono text-gray-400 mt-1 uppercase">24h Preserved Vault</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">{stats.messages}</div>
              <div className="text-[11px] font-mono text-gray-400 mt-1 uppercase">Emails Received</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">{stats.domains_count}</div>
              <div className="text-[11px] font-mono text-gray-400 mt-1 uppercase">Connected Domains</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
