import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// 👑 Crown Logo (Multi-point regal crown with central gem & neomorphic glow)
export const CrownLogo: React.FC<IconProps> = ({ className = 'w-6 h-6', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2.5 19h19c.55 0 1 .45 1 1s-.45 1-1 1h-19c-.55 0-1-.45-1-1s.45-1 1-1zm2.5-3.5l-2.8-10.4c-.2-.7.6-1.3 1.2-.9l5.1 3.5 3.5-5.5c.3-.5 1.1-.5 1.4 0l3.5 5.5 5.1-3.5c.6-.4 1.4.2 1.2.9l-2.8 10.4c-.1.5-.6.9-1.2.9h-13c-.6 0-1.1-.4-1.2-.9z" />
    <circle cx="12" cy="14" r="1.5" fill="#00f0ff" opacity="0.9" />
  </svg>
);

// ❄️ Cold Vault Icon (Cryogenic hexagonal vault with snowflake core)
export const ColdVaultIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" stroke="#00f0ff" strokeWidth="1.5" />
    <path d="M12 7v10M8 9.5l8 5M16 9.5l-8 5" stroke="#38bdf8" />
    <circle cx="12" cy="12" r="2" fill="#00f0ff" fillOpacity="0.4" />
  </svg>
);

// ⚡ Direct Port 25 SMTP Engine Icon
export const Port25Icon: React.FC<IconProps> = ({ className = 'w-5 h-5', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#00f0ff" fill="#00f0ff" fillOpacity="0.15" />
  </svg>
);

// 🛡️ Shield Security Icon
export const ShieldLockIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#10b981" />
    <rect x="9.5" y="11" width="5" height="4" rx="1" stroke="#10b981" fill="#10b981" fillOpacity="0.2" />
    <path d="M11 11V9.5a1 1 0 012 0V11" stroke="#10b981" />
  </svg>
);

// 💬 Discord Official Vector Icon
export const DiscordLogo: React.FC<IconProps> = ({ className = 'w-5 h-5', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

// 🌐 Multi-Domain Mesh Icon
export const MultiDomainIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', size }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke="#a855f7" />
    <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="#c084fc" />
  </svg>
);
