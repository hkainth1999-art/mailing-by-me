import React from 'react';
import { UserProfile } from '../types';
import { CrownLogo, DiscordLogo } from './CustomIcons';
import { Volume2, VolumeX, Shield, Terminal, Mail, LogOut, Home } from 'lucide-react';

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
          <CrownLogo className="w-6 h-6 text-cyan-300" />
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
            currentPage === 'home'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onNavigate('/inbox')}
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
            <DiscordLogo className="w-4 h-4" />
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
