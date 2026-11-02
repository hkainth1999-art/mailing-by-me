import React from 'react';
import { UserProfile } from '../types';
import { Volume2, VolumeX, Shield, Terminal, Mail, LogOut, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  currentPage: string;
  onNavigate: (page: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  wsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentPage,
  onNavigate,
  soundEnabled,
  onToggleSound,
  wsConnected,
}) => {
  const isOwner = Boolean(user?.user?.isOwner);

  return (
    <header className="clay-plate px-4 sm:px-6 py-3.5 sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 rounded-none md:rounded-b-2xl">
      {/* Brand & Taglines */}
      <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => onNavigate('/')}>
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 shrink-0">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path>
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1">
              CROWN<span className="text-cyan-400">VAULT</span>
            </h1>
            <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
              Port 25 SMTP
            </span>
            <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold hidden sm:inline-block">
              24h Cold Preserve
            </span>
          </div>
          <p className="text-[11px] text-gray-400 font-mono hidden md:block">Zero Middleman • Zero Deletions • Multi-Domain</p>
        </div>
      </div>

      {/* Center Navigation Links (Separate Pages) */}
      <nav className="flex items-center gap-1.5 clay-pill p-1 border border-white/5 bg-vault-950/40">
        <button
          onClick={() => onNavigate('/')}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition-all ${
            currentPage === 'mailbox'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Mailbox</span>
        </button>

        <button
          onClick={() => onNavigate('/docs')}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition-all ${
            currentPage === 'docs'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>API & Docs</span>
        </button>

        {isOwner && (
          <button
            onClick={() => onNavigate('/admin')}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              currentPage === 'admin'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin Vault</span>
          </button>
        )}
      </nav>

      {/* Right Controls: Sound, Discord Profile, Mesh Status */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Sound Toggle */}
        <button
          onClick={onToggleSound}
          title="Toggle Email Chime"
          className="clay-btn px-2.5 py-1.5 text-xs text-gray-300 gap-1.5"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
          <span className="text-[11px] font-mono hidden lg:inline">{soundEnabled ? 'Sound ON' : 'Muted'}</span>
        </button>

        {/* Discord Login / User Pill */}
        {user?.loggedIn && user.user ? (
          <div className="clay-pill px-3 py-1.5 flex items-center gap-2 border border-purple-500/30">
            {user.user.avatar ? (
              <img src={user.user.avatar} alt="Avatar" className="w-5 h-5 rounded-full bg-purple-900 border border-purple-400" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                {user.user.username.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-mono text-white font-bold max-w-[110px] truncate">
              {user.user.globalName || user.user.username}
            </span>
            {isOwner && (
              <span
                onClick={() => onNavigate('/admin')}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase cursor-pointer hover:bg-amber-500/30"
                title="Click to open Admin Vault"
              >
                👑 OWNER
              </span>
            )}
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.reload();
              }}
              title="Logout"
              className="text-gray-400 hover:text-rose-400 ml-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/discord/login"
            className="clay-btn-discord px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 shadow-md shadow-purple-600/20"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <span>Login with Discord</span>
          </a>
        )}

        {/* Live Mesh Status */}
        <div
          className={`clay-pill flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-mono ${
            wsConnected ? 'text-emerald-400 border border-emerald-500/20' : 'text-amber-400 border border-amber-500/20'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 pulse-live' : 'bg-amber-400'}`}></span>
          <span className="hidden sm:inline">{wsConnected ? 'VAULT LIVE' : 'RECONNECTING'}</span>
        </div>
      </div>
    </header>
  );
};
