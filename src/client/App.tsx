import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HeroPage } from './pages/HeroPage';
import { MailboxPage } from './pages/MailboxPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { AdminPage } from './pages/AdminPage';
import { UserProfile } from './types';

// Web Audio synthesizer for pristine notification chime without external file dependencies
function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.22, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.12);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  } catch (err) {
    // Audio context may be restricted by autoplay policy until user gesture
  }
}

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('crown_sound_enabled') !== 'false';
  });
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [activeAddress, setActiveAddress] = useState<string>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/inbox/')) {
      return decodeURIComponent(path.replace('/inbox/', ''));
    }
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && hash.includes('@') && !hash.includes('=')) {
      return decodeURIComponent(hash);
    }
    return '';
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine current page key
  let currentPage = 'home';
  if (currentPath === '/docs' || currentPath.startsWith('/docs') || currentPath === '/api-tester') {
    currentPage = 'docs';
  } else if (currentPath === '/admin' || currentPath.startsWith('/admin')) {
    currentPage = 'admin';
  } else if (currentPath === '/inbox' || currentPath.startsWith('/inbox/')) {
    currentPage = 'mailbox';
  } else if (currentPath === '/') {
    currentPage = activeAddress ? 'mailbox' : 'home';
  }

  // Fetch current user
  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch {
      setUser({ loggedIn: false });
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  // Browser navigation popstate listener
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      if (window.location.pathname.startsWith('/inbox/')) {
        setActiveAddress(decodeURIComponent(window.location.pathname.replace('/inbox/', '')));
      } else if (window.location.pathname === '/') {
        setActiveAddress('');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation handler
  const handleNavigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    if (path === '/') {
      setActiveAddress('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddressChange = (addr: string) => {
    setActiveAddress(addr);
    const newPath = addr ? `/inbox/${encodeURIComponent(addr)}` : '/inbox';
    if (window.location.pathname !== newPath) {
      window.history.pushState({}, '', newPath);
      setCurrentPath(newPath);
    }
    // Update WebSocket subscription
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && addr) {
      wsRef.current.send(JSON.stringify({ action: 'subscribe', address: addr }));
    }
  };

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('crown_sound_enabled', String(next));
      if (next) playChimeSound();
      return next;
    });
  };

  // Connect WebSocket for live inbound notifications
  const connectWs = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?address=${encodeURIComponent(activeAddress || '*')}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (activeAddress) {
          ws.send(JSON.stringify({ action: 'subscribe', address: activeAddress }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'new_email' || payload.type === 'new_message') {
            if (soundEnabled) {
              playChimeSound();
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimeoutRef.current = setTimeout(connectWs, 5000);
    }
  }, [activeAddress, soundEnabled]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar
        user={user}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        wsConnected={wsConnected}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {currentPage === 'home' && (
          <HeroPage
            user={user}
            onGoToMailbox={(addr) => {
              if (addr) {
                handleAddressChange(addr);
              } else {
                handleNavigate('/inbox');
              }
            }}
            onGoToDocs={() => handleNavigate('/docs')}
          />
        )}

        {currentPage === 'mailbox' && (
          <MailboxPage
            user={user}
            soundEnabled={soundEnabled}
            onPlayChime={playChimeSound}
            initialAddress={activeAddress}
            onAddressChange={handleAddressChange}
          />
        )}

        {currentPage === 'docs' && <ApiDocsPage />}

        {currentPage === 'admin' && (
          user?.user?.isOwner ? (
            <AdminPage />
          ) : (
            <div className="clay-card p-8 text-center max-w-md mx-auto my-12 border border-rose-500/30">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-white mb-2">Owner Authorization Required</h2>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                The Crown Admin Vault is cryptographically restricted to authorized Owner IDs only. Please log in with an authorized Discord account.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleNavigate('/')}
                  className="clay-btn px-4 py-2 text-xs text-gray-300"
                >
                  Return to Home
                </button>
                <a
                  href="/api/auth/discord/login"
                  className="clay-btn-discord px-4 py-2 text-xs text-white"
                >
                  Login with Discord
                </a>
              </div>
            </div>
          )
        )}
      </main>

      <footer className="mt-auto border-t border-white/5 py-4 text-center text-xs font-mono text-gray-500">
        <p>Crown Mail Vault v2.0 • Inbound Port 25 Engine • Zero Credential Leaks</p>
      </footer>
    </div>
  );
};
