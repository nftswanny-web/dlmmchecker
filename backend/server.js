const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.PORT || 3001;
const GMGN_API_KEY = process.env.GMGN_API_KEY || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const GMGN_BASE_URL = process.env.GMGN_BASE_URL || 'https://gmgn.ai';

app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));
app.use(express.json());

function getGmgnDeviceId() {
  return 'solcheck_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildMetaQuery() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const appVer = `${now.getFullYear()}.${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const params = new URLSearchParams({
    device_id: getGmgnDeviceId(),
    client_id: 'gmgn_web_' + appVer,
    from_app: 'gmgn',
    app_ver: appVer,
    tz_name: 'Europe/Rome',
    tz_offset: '3600',
    app_lang: 'en-US',
  });
  return params.toString();
}

async function gmgnRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body;
  const fullUrl = GMGN_BASE_URL + path;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Origin': 'https://gmgn.ai',
    'Referer': 'https://gmgn.ai/',
    'Cookie': GMGN_API_KEY ? 'gmgn_api_token=' + GMGN_API_KEY : '',
    'X-APIKEY': GMGN_API_KEY || undefined,
    'x-route-key': GMGN_API_KEY || undefined,
  };
  if (method !== 'GET') headers['Content-Type'] = 'application/json';

  const response = await fetch(fullUrl, {
    method,
    headers,
    body: method === 'GET' || body == null ? undefined : JSON.stringify(body),
    timeout: 25000,
    redirect: 'follow',
  });

  const text = await response.text();
  const debugHeaders = {
    'content-type': response.headers.get('content-type'),
    'server': response.headers.get('server'),
    'cf-ray': response.headers.get('cf-ray'),
    'cf-cache-status': response.headers.get('cf-cache-status'),
  };

  try {
    return {
      ok: response.ok,
      status: response.status,
      headers: debugHeaders,
      data: JSON.parse(text),
    };
  } catch (error) {
    return {
      ok: response.ok,
      status: response.status,
      headers: debugHeaders,
      text,
    };
  }
}

function normalizeGMGNToken(payload) {
  const data = payload?.data;
  if (!data) return null;
  if (data.token || data.pair) return data;
  if (Array.isArray(data)) return data[0] || null;
  if (data.data?.token || data.data?.pair) return data.data;
  if (data.data && typeof data.data === 'object') return data.data;
  return data;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    hasApiKey: Boolean(GMGN_API_KEY),
  });
});

app.get('/gmgn/token/:mint', async (req, res) => {
  const mint = req.params.mint;
  const meta = buildMetaQuery();
  const attempts = [
    { path: '/api/v1/multi_window_token_info?' + meta, method: 'POST', body: { chain: 'sol', addresses: [mint] } },
    { path: '/api/v1/mutil_window_token_info?' + meta, method: 'POST', body: { chain: 'sol', addresses: [mint] } },
    { path: '/api/v1/multi_window_token_info/sol/' + mint, method: 'GET' },
    { path: '/api/v1/mutil_window_token_info/sol/' + mint, method: 'GET' },
    { path: '/api/v1/token_info/sol/' + mint, method: 'GET' },
    { path: '/defi/quotation/v1/tokens/sol/' + mint, method: 'GET' },
  ];

  const debug = [];

  for (const attempt of attempts) {
    const result = await gmgnRequest(attempt.path, attempt);
    debug.push({
      path: attempt.path,
      method: attempt.method,
      ok: result.ok,
      status: result.status,
      headers: result.headers,
      bodyPreview: result.text ? result.text.substring(0, 300) : undefined,
    });

    const normalized = normalizeGMGNToken(result.data);
    if (normalized && (result.data?.code === 0 || result.data?.data || normalized.token || normalized.pair || normalized.market_cap != null)) {
      return res.json({
        ok: true,
        source: attempt.path,
        data: normalized,
      });
    }
  }

  return res.status(502).json({
    ok: false,
    error: 'gmgn_unavailable',
    message: 'GMGN did not return usable token data.',
    debug,
  });
});

app.get('/gmgn/kols/:mint', async (req, res) => {
  const mint = req.params.mint;
  const path = '/defi/quotation/v1/tokens/top_traders/sol/' + mint + '?orderby=profit&direction=desc';
  const result = await gmgnRequest(path, { method: 'GET' });

  if (!result.ok || !result.data) {
    return res.status(502).json({
      ok: false,
      error: 'gmgn_kols_unavailable',
      status: result.status,
      headers: result.headers,
      bodyPreview: result.text ? result.text.substring(0, 500) : undefined,
    });
  }

  const traders = result.data?.data?.list || result.data?.data || [];
  const filtered = Array.isArray(traders)
    ? traders.filter((t) =>
        (t.tags || []).includes('renowned') ||
        t.wallet_tag_v2 === 'renowned' ||
        (t.twitter_username && t.twitter_name)
      )
    : [];

  return res.json({
    ok: true,
    data: filtered,
  });
});

app.listen(PORT, () => {
  console.log('GMGN backend listening on port ' + PORT);
});
