import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Zap, Shield, Info, ArrowRight, ExternalLink } from 'lucide-react';

export const ApiDocsPage: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tester state
  const [selectedEndpoint, setSelectedEndpoint] = useState('domains');
  const [paramInput, setParamInput] = useState('demo@rizzcord.site');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [responseJson, setResponseJson] = useState<string>('Click "SEND REQUEST" to inspect live response...');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunRequest = async () => {
    setLoading(true);
    setStatusText('Connecting...');
    setStatusCode(null);
    setResponseJson('Transmitting request packet...');

    let url = '';
    let method = 'GET';
    let body: any = null;
    const headers: Record<string, string> = {};

    if (apiKeyInput.trim()) {
      headers['x-api-key'] = apiKeyInput.trim();
    }

    const cleanParam = paramInput.trim();

    if (selectedEndpoint === 'domains') {
      url = '/domains';
    } else if (selectedEndpoint === 'api-domains') {
      url = '/api/domains';
    } else if (selectedEndpoint === 'messages') {
      url = `/api/messages/${encodeURIComponent(cleanParam)}`;
    } else if (selectedEndpoint === 'discord') {
      url = `/api/discord/${encodeURIComponent(cleanParam)}?wait=false`;
    } else if (selectedEndpoint === 'user-inboxes') {
      url = '/api/user/inboxes';
    } else if (selectedEndpoint === 'create-inbox') {
      url = '/api/inbox/create';
      method = 'POST';
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ address: cleanParam });
    } else if (selectedEndpoint === 'delete-inbox') {
      url = `/api/user/mailboxes/${encodeURIComponent(cleanParam)}`;
      method = 'DELETE';
    } else if (selectedEndpoint === 'stats') {
      url = '/api/stats';
    }

    const t0 = performance.now();
    try {
      const res = await fetch(url, { method, headers, body });
      const t1 = performance.now();
      setLatency(Math.round(t1 - t0));
      setStatusCode(res.status);
      setStatusText(`${res.status} ${res.statusText}`);

      const data = await res.json();
      setResponseJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      const t1 = performance.now();
      setLatency(Math.round(t1 - t0));
      setStatusCode(500);
      setStatusText('Network Error');
      setResponseJson(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const getCurlSnippet = (endpoint: string, param: string) => {
    const host = baseUrl || 'https://tempmail.rizzcord.site';
    const cleanParam = param || 'demo@rizzcord.site';

    switch (endpoint) {
      case 'domains':
        return `curl -X GET "${host}/domains"`;
      case 'api-domains':
        return `curl -X GET "${host}/api/domains"`;
      case 'messages':
        return `curl -X GET "${host}/api/messages/${cleanParam}"`;
      case 'discord':
        return `curl -X GET "${host}/api/discord/${cleanParam}?wait=true&timeout=30"`;
      case 'user-inboxes':
        return `curl -X GET "${host}/api/user/inboxes"`;
      case 'create-inbox':
        return `curl -X POST "${host}/api/inbox/create" \\\n  -H "Content-Type: application/json" \\\n  -d '{"address": "${cleanParam}"}'`;
      case 'delete-inbox':
        return `curl -X DELETE "${host}/api/user/mailboxes/${cleanParam}"`;
      case 'stats':
        return `curl -X GET "${host}/api/stats"`;
      default:
        return `curl -X GET "${host}/domains"`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Banner */}
      <div className="clay-plate p-6 border border-cyan-500/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/20">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-mono font-bold text-white flex items-center gap-2">
                Crown Mail REST API & Documentation
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Zero-rate-limit leaks • High-speed disposable email engine • Automatic Discord OTP detection
              </p>
            </div>
          </div>

          {/* Base URL Box */}
          <div className="clay-inset p-3 rounded-2xl flex items-center justify-between gap-3 border border-cyan-500/30 bg-cyan-950/20">
            <div>
              <div className="text-[10px] font-mono uppercase text-gray-400 font-bold">API Base URL:</div>
              <div className="text-sm font-mono font-black text-cyan-300 select-all">{baseUrl}</div>
            </div>
            <button
              onClick={() => copyToClipboard(baseUrl, 'base-url')}
              className="clay-btn px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 hover:text-white flex items-center gap-1.5"
            >
              {copiedKey === 'base-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'base-url' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Policies & Limits Banner (Rate Limiting & 3-Mailbox Quota) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rate Limiting Card */}
        <div className="clay-plate p-5 border border-emerald-500/30 bg-emerald-950/10 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
            <Shield className="w-4 h-4" />
            <span>Active Rate Limiting</span>
          </div>
          <p className="text-xs font-mono text-gray-300 leading-relaxed">
            All endpoints are protected by IP-based sliding window rate limiters to ensure 100% server uptime:
          </p>
          <ul className="text-xs font-mono text-gray-400 space-y-1 list-disc list-inside">
            <li><strong className="text-white">General API:</strong> 120 requests / minute</li>
            <li><strong className="text-white">Mailbox Creation:</strong> 12 mailbox creations / 10 minutes</li>
            <li><strong className="text-white">Discord OTP Polling:</strong> 90 requests / minute</li>
            <li><strong className="text-white">Exceeded Response:</strong> Returns <code className="text-amber-300 font-bold">HTTP 429 Too Many Requests</code> with <code className="text-cyan-300">Retry-After</code> header.</li>
          </ul>
        </div>

        {/* 3-Mailbox Quota Card */}
        <div className="clay-plate p-5 border border-purple-500/30 bg-purple-950/10 space-y-2.5">
          <div className="flex items-center gap-2 text-purple-400 font-mono font-bold text-sm">
            <Info className="w-4 h-4" />
            <span>3-Mailbox Quota Policy</span>
          </div>
          <p className="text-xs font-mono text-gray-300 leading-relaxed">
            To prevent bot spam, standard Discord users can hold up to <strong className="text-cyan-300">3 active mailboxes</strong> simultaneously.
          </p>
          <ul className="text-xs font-mono text-gray-400 space-y-1 list-disc list-inside">
            <li>When at 3/3 active mailboxes, creation returns <code className="text-rose-400">HTTP 403 QUOTA_REACHED</code>.</li>
            <li>Delete an old mailbox via <code className="text-cyan-300">DELETE /api/user/mailboxes/:address</code> to immediately free up a creation slot!</li>
            <li>Vault Owners (<code className="text-amber-300">OWNER_IDS</code>) have unlimited mailboxes.</li>
          </ul>
        </div>
      </div>

      {/* Interactive API Tester Deck */}
      <div className="clay-plate p-6 border border-cyan-500/30 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Interactive API Runner & Request Tester
            </h3>
          </div>
          <span className="text-[11px] font-mono text-gray-400">Live Server Communication</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">Target Endpoint:</label>
            <select
              value={selectedEndpoint}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
              className="w-full clay-inset px-3 py-2 text-xs font-mono text-cyan-300 outline-none cursor-pointer"
            >
              <option value="domains">GET /domains (Accepted Domains)</option>
              <option value="api-domains">GET /api/domains (API Domain List)</option>
              <option value="messages">GET /api/messages/:address (Inbox Messages)</option>
              <option value="discord">GET /api/discord/:address (Discord OTP Extractor)</option>
              <option value="create-inbox">POST /api/inbox/create (Create Mailbox)</option>
              <option value="delete-inbox">DELETE /api/user/mailboxes/:address (Free Quota Slot)</option>
              <option value="user-inboxes">GET /api/user/inboxes (User Inboxes & Quota)</option>
              <option value="stats">GET /api/stats (Vault Metrics)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">Address / Parameter:</label>
            <input
              type="text"
              value={paramInput}
              onChange={(e) => setParamInput(e.target.value)}
              placeholder="e.g. alexander@rizzcord.site"
              className="w-full clay-inset px-3 py-2 text-xs font-mono text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-gray-400 mb-1">API Key Header (optional):</label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="crwn_... (for protected routes)"
              className="w-full clay-inset px-3 py-2 text-xs font-mono text-white outline-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunRequest}
            disabled={loading}
            className="clay-btn-primary px-5 py-2.5 text-xs font-mono font-bold flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-black" />
            <span>{loading ? 'SENDING...' : 'SEND REQUEST'}</span>
          </button>

          <button
            onClick={() => copyToClipboard(getCurlSnippet(selectedEndpoint, paramInput), 'tester-curl')}
            className="clay-btn px-4 py-2.5 text-xs font-mono text-gray-300 hover:text-white flex items-center gap-1.5"
          >
            {copiedKey === 'tester-curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'tester-curl' ? 'Copied cURL!' : 'Copy cURL'}</span>
          </button>
        </div>

        {/* Response Viewer */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>Response Payload:</span>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  statusCode && statusCode < 300
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : statusCode && statusCode >= 400
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {statusText}
              </span>
              {latency !== null && <span className="text-cyan-400">{latency}ms</span>}
            </div>
          </div>
          <pre className="clay-inset p-4 text-xs font-mono text-gray-300 max-h-72 overflow-auto whitespace-pre-wrap select-all">
            {responseJson}
          </pre>
        </div>
      </div>

      {/* Complete Endpoint Documentation Catalog */}
      <div className="space-y-4">
        <h3 className="text-base font-mono font-bold text-white flex items-center gap-2">
          <span>📚</span>
          <span>Complete Endpoint Reference</span>
        </h3>

        {/* 1. GET /domains */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-white">/domains</code>
              <span className="text-gray-500 text-xs">or</span>
              <code className="text-sm font-mono font-bold text-white">/api/domains</code>
            </div>
            <span className="text-[11px] font-mono text-gray-400">Public • No Auth Required</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Returns the list of active inbound domains configured on the mail server along with the primary default domain.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X GET "{baseUrl}/domains"</span>
            <button
              onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/domains"`, 'curl-domains')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-domains' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 2. POST /api/inbox/create */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/inbox/create</code>
            </div>
            <span className="text-[11px] font-mono text-purple-400">Discord Session Cookie / Auth</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Registers a new custom or random mailbox. Enforces the 3-mailbox quota for standard users (Owner is unlimited).
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X POST "{baseUrl}/api/inbox/create" -H "Content-Type: application/json" -d '&#123;"address":"alexander@rizzcord.site"&#125;'</span>
            <button
              onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api/inbox/create" -H "Content-Type: application/json" -d '{"address":"alexander@rizzcord.site"}'`, 'curl-create')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-create' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 3. GET /api/messages/:address */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/messages/:address</code>
            </div>
            <span className="text-[11px] font-mono text-gray-400">Public or API Key</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Fetches all messages in an inbox. Automatically decompresses preserved messages if older than 24 hours.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X GET "{baseUrl}/api/messages/alexander@rizzcord.site"</span>
            <button
              onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api/messages/alexander@rizzcord.site"`, 'curl-msgs')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-msgs' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 4. GET /api/discord/:address */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30">
                GET
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/discord/:address?wait=true&timeout=30</code>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">Automated Discord Verification</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Automatically extracts 6-digit Discord verification code or click verify link. Use <code>?wait=true</code> for long-polling.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X GET "{baseUrl}/api/discord/alexander@rizzcord.site?wait=true"</span>
            <button
              onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api/discord/alexander@rizzcord.site?wait=true"`, 'curl-discord')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-discord' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 5. DELETE /api/user/mailboxes/:address */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                DELETE
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/user/mailboxes/:address</code>
            </div>
            <span className="text-[11px] font-mono text-rose-400 font-bold">Frees 1 Quota Slot</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Permanently deletes the mailbox and its emails, immediately reducing your active count and allowing you to create another mailbox.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X DELETE "{baseUrl}/api/user/mailboxes/alexander@rizzcord.site"</span>
            <button
              onClick={() => copyToClipboard(`curl -X DELETE "${baseUrl}/api/user/mailboxes/alexander@rizzcord.site"`, 'curl-del')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-del' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 6. WebSocket Live Inbound Feed */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                WSS
              </span>
              <code className="text-sm font-mono font-bold text-white">/ws?address=:address</code>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">Realtime WebSocket</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Connect via WebSocket to receive instant real-time JSON pushes whenever an email arrives on Port 25 for that address.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-emerald-300 overflow-x-auto">
            wss://{baseUrl.replace(/^https?:\/\//, '')}/ws?address=alexander@rizzcord.site
          </div>
        </div>
      </div>
    </div>
  );
};
