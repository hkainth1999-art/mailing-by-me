import React, { useState, useEffect } from 'react';
import { Terminal, Copy, Check, Zap, Shield, Info, ArrowRight, Code2 } from 'lucide-react';

export const ApiDocsPage: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [codeLang, setCodeLang] = useState<'python' | 'javascript' | 'curl'>('python');

  // Tester state
  const [selectedEndpoint, setSelectedEndpoint] = useState('discord-verify');
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
    } else if (selectedEndpoint === 'link') {
      url = `/api/link/${encodeURIComponent(cleanParam)}?wait=true&timeout=15`;
    } else if (selectedEndpoint === 'discord-verify') {
      url = `/api/discord/verify/${encodeURIComponent(cleanParam)}?wait=true&timeout=15`;
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
      setStatusText('Network/CORS Error');
      setResponseJson(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const pythonExample = `import requests
import time

BASE_URL = "${baseUrl || 'https://tempmail.rizzcord.site'}"
API_KEY = "YOUR_CROWN_API_KEY"  # Generated in Admin Vault

headers = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
}

# 1. Discover active domains
domains_res = requests.get(f"{BASE_URL}/domains")
domains = domains_res.json().get("domains", ["rizzcord.site"])
target_domain = domains[0]

# 2. Generate custom or random email address
target_address = f"verify_{int(time.time())}@{target_domain}"
print(f"[*] Target Email: {target_address}")

# 3. Auto-Extract Discord Verification Link & OTP Code (Long-polling up to 30s)
# Note: For Owner API keys, prior mailbox creation is bypassed automatically!
print("[*] Waiting for incoming Discord verification email...")
verify_res = requests.get(
    f"{BASE_URL}/api/discord/verify/{target_address}",
    params={"wait": "true", "timeout": 30},
    headers=headers
)

if verify_res.status_code == 200:
    data = verify_res.json()
    print("✅ Discord Email Detected!")
    print(f"🔗 Verification Link: {data.get('verification_url')}")
    print(f"🔢 6-Digit OTP Code:  {data.get('discord_code')}")
    print(f"📬 From Address:      {data.get('from_address')}")
    
    # Optional: Automatically click/verify link
    if data.get("verification_url"):
        click_res = requests.get(data["verification_url"], allow_redirects=True)
        print(f"[+] Verified successfully (HTTP {click_res.status_code})")
else:
    print(f"[-] Verification timed out or failed: {verify_res.text}")
`;

  const jsExample = `// Crown Mail Vault API Client (Node.js 18+ or Browser)
const BASE_URL = "${baseUrl || 'https://tempmail.rizzcord.site'}";
const API_KEY = "YOUR_CROWN_API_KEY"; // Generated in Admin Vault

async function runDiscordVerificationAutomation() {
  const headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  // 1. Get active domains
  const domainRes = await fetch(\`\${BASE_URL}/domains\`);
  const { domains } = await domainRes.json();
  const domain = domains[0] || 'rizzcord.site';

  const address = \`bot_\${Date.now()}@\${domain}\`;
  console.log(\`[*] Using mailbox: \${address}\`);

  // 2. Wait for Discord Verification Email with 1-click Link & 6-digit Code
  console.log('[*] Polling for Discord email on Port 25...');
  const verifyRes = await fetch(
    \`\${BASE_URL}/api/discord/verify/\${encodeURIComponent(address)}?wait=true&timeout=30\`,
    { headers }
  );

  if (verifyRes.ok) {
    const data = await verifyRes.json();
    console.log('✅ Discord Verification Found!');
    console.log('🔗 Link:', data.verification_url);
    console.log('🔢 Code:', data.discord_code);
    return data;
  } else {
    console.error('[-] Timeout waiting for email:', await verifyRes.text());
  }
}

runDiscordVerificationAutomation();
`;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="clay-plate p-6 border border-white/5 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Crown API Documentation & Interactive Runner</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                  v2.0
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Direct Inbound Port 25 Engine • Rate-Limited • Zero Credential Leaks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-400">Base URL:</span>
            <div className="clay-inset px-3 py-1 text-xs font-mono text-cyan-300 flex items-center gap-2">
              <span>{baseUrl}</span>
              <button
                onClick={() => copyToClipboard(baseUrl, 'base')}
                className="text-gray-400 hover:text-white"
              >
                {copiedKey === 'base' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limits & Quotas Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="clay-card p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400 uppercase font-bold">General API Rate Limit</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">120 <span className="text-xs font-normal text-gray-400">req / min</span></div>
          <p className="text-[11px] text-gray-400 font-mono">
            Protects server from floods. Sliding window with automatic IP bucket reset.
          </p>
        </div>

        <div className="clay-card p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400 uppercase font-bold">Discord Verification API</span>
            <Terminal className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">90 <span className="text-xs font-normal text-gray-400">req / min</span></div>
          <p className="text-[11px] text-gray-400 font-mono">
            Requires <code>x-api-key</code> or Discord session. Supports polling with <code>?wait=true</code>.
          </p>
        </div>

        <div className="clay-card p-5 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400 uppercase font-bold">Standard User Quota</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">3 <span className="text-xs font-normal text-gray-400">mailboxes max</span></div>
          <p className="text-[11px] text-gray-400 font-mono">
            Delete an existing mailbox to create a new one. <span className="text-amber-300 font-bold">Owner API Key: Unlimited.</span>
          </p>
        </div>
      </div>

      {/* CODE EXAMPLES (Python & JavaScript) */}
      <div className="clay-plate p-6 border border-white/5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Integration Code Examples (Python & JavaScript)
            </h3>
          </div>

          <div className="flex items-center gap-1.5 clay-pill p-1 border border-white/5 bg-black/40">
            <button
              onClick={() => setCodeLang('python')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                codeLang === 'python' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              Python (requests)
            </button>
            <button
              onClick={() => setCodeLang('javascript')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                codeLang === 'javascript' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-gray-400 hover:text-white'
              }`}
            >
              JavaScript / Node.js
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="clay-inset p-4 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto max-h-[380px] leading-relaxed">
            <code>{codeLang === 'python' ? pythonExample : jsExample}</code>
          </pre>
          <button
            onClick={() => copyToClipboard(codeLang === 'python' ? pythonExample : jsExample, 'code-sample')}
            className="absolute top-3 right-3 clay-btn px-2.5 py-1 text-xs font-mono text-cyan-300 flex items-center gap-1 bg-black/80"
          >
            {copiedKey === 'code-sample' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy Code</span>
          </button>
        </div>
      </div>

      {/* INTERACTIVE REQUEST RUNNER */}
      <div className="clay-plate p-6 border border-cyan-500/30 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
              Live Interactive Request Runner
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            {statusCode && (
              <span className={`px-2 py-0.5 rounded font-bold ${
                statusCode >= 200 && statusCode < 300 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {statusText}
              </span>
            )}
            {latency !== null && (
              <span className="text-gray-400">{latency} ms</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4 space-y-1">
            <label className="text-[11px] font-mono text-gray-400">Endpoint Action</label>
            <select
              value={selectedEndpoint}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
              className="w-full bg-[#080b12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
            >
              <option value="link">GET /api/link/:address (Direct Verification Link Only)</option>
              <option value="discord-verify">GET /api/discord/verify/:address (Auto-Extract Link & OTP)</option>
              <option value="domains">GET /domains (Active Domains)</option>
              <option value="api-domains">GET /api/domains (Domains API)</option>
              <option value="messages">GET /api/messages/:address (Inbox Messages)</option>
              <option value="discord">GET /api/discord/:address (Quick OTP)</option>
              <option value="create-inbox">POST /api/inbox/create (Create Mailbox)</option>
              <option value="user-inboxes">GET /api/user/inboxes (Your Mailboxes & Quota)</option>
              <option value="delete-inbox">DELETE /api/user/mailboxes/:address (Free Slot)</option>
              <option value="stats">GET /api/stats (Zero IP leak system stats)</option>
            </select>
          </div>

          <div className="lg:col-span-4 space-y-1">
            <label className="text-[11px] font-mono text-gray-400">Parameter (Address / Value)</label>
            <input
              type="text"
              value={paramInput}
              onChange={(e) => setParamInput(e.target.value)}
              placeholder="e.g. alexander@rizzcord.site"
              className="w-full bg-[#080b12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="lg:col-span-2 space-y-1">
            <label className="text-[11px] font-mono text-gray-400">API Key (Optional)</label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="x-api-key..."
              className="w-full bg-[#080b12] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="lg:col-span-2">
            <button
              onClick={handleRunRequest}
              disabled={loading}
              className="clay-btn-primary w-full py-2 px-4 text-xs font-mono font-bold text-black flex items-center justify-center gap-2"
            >
              <span>{loading ? 'RUNNING...' : 'SEND REQUEST'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Response Viewer */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>JSON Output</span>
            <button
              onClick={() => copyToClipboard(responseJson, 'json-out')}
              className="hover:text-cyan-300 flex items-center gap-1"
            >
              {copiedKey === 'json-out' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>Copy Response</span>
            </button>
          </div>
          <pre className="clay-inset p-4 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-[300px]">
            <code>{responseJson}</code>
          </pre>
        </div>
      </div>

      {/* DETAILED ENDPOINTS CARDS */}
      <div className="space-y-4">
        <h3 className="text-sm font-mono font-bold text-gray-300 uppercase tracking-wider">
          Complete Endpoint Directory
        </h3>

        {/* 0. GET /api/link/:address - Direct Verification Link Extractor */}
        <div className="clay-plate p-5 border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30">
                GET / POST
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/link/:address</code>
              <span className="text-gray-500 text-xs">or</span>
              <code className="text-sm font-mono font-bold text-white">/api/verify-link/:address</code>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">Secure • Long-Polling Enabled</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Loops and extracts <strong>ONLY the verification link</strong> from the target email. Supports <code className="text-cyan-300">?format=text</code> to return the raw URL string directly, <code className="text-purple-300">?redirect=true</code> to issue a 302 browser redirect, or standard JSON. Holds connection up to <code className="text-purple-300">?timeout=30</code> seconds until the email arrives.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X GET "{baseUrl}/api/link/alexander@rizzcord.site?wait=true&timeout=30&format=text" -H "x-api-key: YOUR_KEY"</span>
            <button
              onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api/link/alexander@rizzcord.site?wait=true&timeout=30&format=text" -H "x-api-key: YOUR_KEY"`, 'curl-link')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 1. GET /api/discord/verify/:address */}
        <div className="clay-plate p-5 border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30">
                GET / POST
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/discord/verify/:address</code>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">Secure • Demands API Key or Session</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Automatically extracts the Discord 1-click verification link (<code className="text-cyan-300">https://click.discord.com/...</code>) and 6-digit verification code. Uses long-polling (<code className="text-purple-300">?wait=true&timeout=30</code>) to hold the connection until the email arrives on Port 25.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X GET "{baseUrl}/api/discord/verify/alexander@rizzcord.site?wait=true&timeout=30" -H "x-api-key: YOUR_KEY"</span>
            <button
              onClick={() => copyToClipboard(`curl -X GET "${baseUrl}/api/discord/verify/alexander@rizzcord.site?wait=true&timeout=30" -H "x-api-key: YOUR_KEY"`, 'curl-verify')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-verify' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 2. GET /domains */}
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

        {/* 3. POST /api/inbox/create */}
        <div className="clay-plate p-5 border border-white/5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/inbox/create</code>
            </div>
            <span className="text-[11px] font-mono text-purple-400">Discord Session OR x-api-key</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Registers a new mailbox. Standard users have a 3-mailbox quota limit. Owner API key has <strong className="text-amber-300">unlimited</strong> mailboxes, and API-created mailboxes are automatically hidden from website recent lists!
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X POST "{baseUrl}/api/inbox/create" -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '&#123;"address":"alexander@rizzcord.site"&#125;'</span>
            <button
              onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api/inbox/create" -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '{"address":"alexander@rizzcord.site"}'`, 'curl-create')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-create' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 4. GET /api/messages/:address */}
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
            Fetches all messages in an inbox. Automatically decompresses preserved messages if older than 24 hours. Owner API key can query directly without prior mailbox creation!
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
            Permanently deletes the mailbox and its emails, immediately freeing 1 slot in your 3-mailbox quota.
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

        {/* 6. POST /api/send (Send Password Resets & Outbound Mails) */}
        <div className="clay-plate p-5 border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                POST
              </span>
              <code className="text-sm font-mono font-bold text-white">/api/send</code>
              <span className="text-gray-500 text-xs">or</span>
              <code className="text-sm font-mono font-bold text-white">/api/mail/send</code>
            </div>
            <span className="text-[11px] font-mono text-cyan-300 font-bold">Outbound Transactional Sender</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Send password reset links, verification codes, and notification emails from your other websites directly via HTTP REST API. Authenticated via <code className="text-cyan-300">x-api-key</code>.
          </p>
          <div className="clay-inset p-3 text-xs font-mono text-cyan-300 flex items-center justify-between gap-2 overflow-x-auto">
            <span>curl -X POST "{baseUrl}/api/send" -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '&#123;"to":"user@example.com","subject":"Reset Password","html":"&lt;p&gt;Click to reset your password&lt;/p&gt;"&#125;'</span>
            <button
              onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api/send" -H "x-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '{"to":"user@example.com","subject":"Reset Password","html":"<p>Click to reset your password</p>"}'`, 'curl-send')}
              className="text-gray-400 hover:text-white shrink-0"
            >
              {copiedKey === 'curl-send' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 7. Outbound SMTP Submission Credentials (Port 587) */}
        <div className="clay-plate p-5 border border-purple-500/30 space-y-3 bg-purple-950/10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30">
                SMTP
              </span>
              <code className="text-sm font-mono font-bold text-white">Outbound SMTP Server (Port 587)</code>
            </div>
            <span className="text-[11px] font-mono text-purple-300 font-bold">Standard SMTP for WordPress / Nodemailer / Laravel</span>
          </div>
          <p className="text-xs font-mono text-gray-300">
            Use these credentials in your other website's mail configuration (WordPress WP Mail SMTP, Nodemailer, Django, etc.) to transmit emails:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <div className="clay-inset p-2.5">
              <span className="text-gray-500 block text-[10px]">SMTP HOST</span>
              <span className="text-cyan-300 font-bold">mail.rizzcord.site</span>
            </div>
            <div className="clay-inset p-2.5">
              <span className="text-gray-500 block text-[10px]">PORT</span>
              <span className="text-white font-bold">587 (or 25)</span>
            </div>
            <div className="clay-inset p-2.5">
              <span className="text-gray-500 block text-[10px]">USERNAME</span>
              <span className="text-purple-300 font-bold">admin / support@rizzcord.site</span>
            </div>
            <div className="clay-inset p-2.5">
              <span className="text-gray-500 block text-[10px]">PASSWORD</span>
              <span className="text-amber-300 font-bold">Your Crown API Key</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
