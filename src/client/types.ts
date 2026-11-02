export interface DomainInfo {
  domain: string;
  is_default: boolean;
  created_at?: number;
}

export interface UserMailbox {
  address: string;
  created_at: number;
  count: number;
  is_preserved?: number | boolean;
}

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  id?: string;
}

export interface EmailMessage {
  id: string | number;
  inbox_address: string;
  from_address: string;
  from_name: string;
  to_address: string;
  subject: string;
  text_body: string;
  html_body: string;
  received_at: number;
  is_compressed?: number | boolean;
  raw_eml?: string;
  attachments?: Attachment[];
}

export interface DiscordVerification {
  found: boolean;
  discord_code?: string;
  discord_url?: string;
  subject?: string;
  from_address?: string;
  received_at?: number;
}

export interface UserProfile {
  loggedIn: boolean;
  discordOAuthConfigured?: boolean;
  user?: {
    id: string;
    username: string;
    globalName?: string;
    avatar?: string;
    isOwner: boolean;
  };
}

export interface SystemStats {
  service: string;
  mailboxes: number;
  preserved_mailboxes: number;
  messages: number;
  compressed_messages: number;
  domains_count: number;
}
