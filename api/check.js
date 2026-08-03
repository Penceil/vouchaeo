/* ==========================================================================
   /api/check  —  live AI visibility check (Vercel serverless function)

   Queries ChatGPT, Perplexity, Gemini and Claude with buyer-style questions
   for the firm's market, then reports, per engine:
     - named:  the firm name appears in the answer text
     - cited:  the firm's domain appears in the answer's sources/citations
     - answer: a short excerpt of what the engine said
     - sources: the source hostnames the engine cited

   Hybrid routing (set these in the Vercel project → Settings → Env Variables):
     OPENROUTER_API_KEY   -> ChatGPT + Claude (one key, web-search plugin)
     GEMINI_API_KEY       -> Gemini, native Google Search grounding (free tier)
     PERPLEXITY_API_KEY   -> Perplexity, native Sonar (optional; falls back to
                             OpenRouter's perplexity/sonar if only OpenRouter is set)

   Optional model overrides:
     OPENROUTER_CHATGPT_MODEL   default openai/gpt-4o
     OPENROUTER_CLAUDE_MODEL    default anthropic/claude-3.5-sonnet
     OPENROUTER_PERPLEXITY_MODEL default perplexity/sonar
     GEMINI_MODEL               default gemini-2.0-flash
     PERPLEXITY_MODEL           default sonar

   NEVER hardcode keys here. Any engine whose key is missing is returned as
   { configured: false } and the UI shows "Not connected" rather than inventing
   a result. Model names / request shapes track the providers' current docs;
   adjust if an API changes. Node 18+ runtime (global fetch).
   ========================================================================== */

const LOGOS = {
  ChatGPT: 'assets/logo-openai.svg',
  Perplexity: 'assets/logo-perplexity.svg',
  Gemini: 'assets/logo-gemini.svg',
  Claude: 'assets/logo-claude.svg',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const firm = String(body.firm || '').trim();
  const website = String(body.website || '').trim();
  const specialty = String(body.specialty || '').trim();
  const city = String(body.city || '').trim();
  const competitor = String(body.competitor || '').trim();

  if (body.botcheck) { res.status(200).json({ ok: true }); return; }        // honeypot
  if (!firm || !specialty || !city) {
    res.status(400).json({ error: 'firm, specialty and city are required' });
    return;
  }

  const domain = cleanDomain(website);
  const queries = buildQueries(specialty, city);
  const primary = queries[0];

  const [chatgpt, perplexity, gemini, claude] = await Promise.all([
    guard('ChatGPT', () => askOpenAI(primary)),
    guard('Perplexity', () => askPerplexity(primary)),
    guard('Gemini', () => askGemini(primary)),
    guard('Claude', () => askClaude(primary)),
  ]);

  const engines = [chatgpt, perplexity, gemini, claude].map((r) =>
    scoreEngine(r, firm, domain, competitor)
  );

  // aggregate: which firm names AI surfaced most across engines (share of voice)
  const tally = {};
  for (const e of engines) {
    for (const name of e.competitors || []) {
      const k = name.trim();
      if (k) tally[k] = (tally[k] || 0) + 1;
    }
  }
  const leaderboard = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const namedCount = engines.filter((e) => e.named).length;
  const competitorNamedCount = competitor ? engines.filter((e) => e.competitorNamed).length : null;

  res.status(200).json({
    firm, domain, specialty, city, competitor,
    query: primary,
    engines,
    summary: { namedCount, total: engines.length, competitorNamedCount, leaderboard },
  });
};

/* ---------- query building + scoring ------------------------------------- */

function buildQueries(specialty, city) {
  return [
    `Who are the best ${specialty} recruiters in ${city}?`,
    `Which staffing firm should I use for ${specialty} roles in ${city}?`,
    `Top ${specialty} search firms in ${city}`,
  ];
}

function scoreEngine(r, firm, domain, competitor) {
  const base = { engine: r.engine, logo: LOGOS[r.engine] };
  if (!r.configured) return { ...base, configured: false };
  if (r.error) return { ...base, configured: true, error: true, answer: r.error };

  const answer = String(r.answer || '');
  const sources = [...new Set((r.sources || []).map(cleanDomain).filter(Boolean))];
  const named = containsFirm(answer, firm);
  const cited = !!domain && sources.some((s) => s.includes(domain) || domain.includes(s));
  const position = named ? findPosition(answer, firm) : null;
  const competitors = extractNamedFirms(answer, firm).slice(0, 6);
  const competitorNamed = !!competitor && containsFirm(answer, competitor);

  return {
    ...base,
    configured: true,
    named,
    cited,
    position,
    competitors,          // firm names AI listed in the answer
    competitorNamed,      // whether the user's named competitor showed up
    sources,              // cited source domains
    answer: trimText(answer, 900),
  };
}

function containsFirm(text, firm) {
  const t = text.toLowerCase();
  const f = firm.toLowerCase().trim();
  if (!f) return false;
  if (t.includes(f)) return true;
  // also try the firm without a trailing legal/word suffix (e.g. "... Partners", "... LLC")
  const core = f.replace(/\s+(partners|group|search|staffing|recruiting|recruitment|associates|llc|inc|co|company)\.?$/i, '').trim();
  return core.length > 3 && t.includes(core);
}

// pull the firm names an answer lists — markdown bold and numbered/bulleted items
function extractNamedFirms(answer, firm) {
  const names = new Set();
  for (const m of answer.matchAll(/\*\*([^*\n]{2,60}?)\*\*/g)) names.add(m[1]);
  for (const m of answer.matchAll(/^\s*(?:\d+[.)]|[-•])\s*\*?\*?([A-Z][A-Za-z0-9&.,'’\- ]{2,50}?)\*?\*?\s*(?:[-:–—(]|$)/gm)) names.add(m[1]);

  const f = firm.toLowerCase();
  const seen = new Set();
  const out = [];
  for (let raw of names) {
    const name = raw.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().replace(/[:.,\-–—]+$/, '').trim();
    const low = name.toLowerCase();
    if (!name || name.length < 2 || low === f || low.includes(f) || f.includes(low)) continue;
    if (/^(here|these|the|top|best|note|overall|key|other|for|when|if|they|it)\b/i.test(name)) continue;
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(name);
  }
  return out;
}

// if the firm sits in a numbered list, return its rank
function findPosition(answer, firm) {
  const f = firm.toLowerCase();
  for (const line of answer.split('\n')) {
    const m = line.match(/^\s*(\d+)[.)]/);
    if (m && line.toLowerCase().includes(f)) return Number(m[1]);
  }
  return null;
}

/* ---------- engine callers ----------------------------------------------- */

/* ChatGPT + Claude (and Perplexity fallback) go through OpenRouter, which is
   OpenAI-compatible and adds a web-search plugin that returns url_citation
   annotations we can inspect for the firm's domain. */
async function askOpenRouter(engine, model, query) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { engine, configured: false };

  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://getlaude.com',
      'X-Title': 'Laud AI visibility check',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: query }],
      plugins: [{ id: 'web' }],
      // cap the output so OpenRouter only reserves a little credit per call
      // (otherwise it reserves the model's full context and rejects on a low balance)
      max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || 1024),
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `OpenRouter ${r.status}`);

  const msg = data.choices?.[0]?.message || {};
  const answer = typeof msg.content === 'string'
    ? msg.content
    : Array.isArray(msg.content) ? msg.content.map((c) => c.text || '').join('') : '';
  const sources = (msg.annotations || [])
    .filter((a) => a.type === 'url_citation')
    .map((a) => a.url_citation?.url || a.url)
    .filter(Boolean);
  return { engine, configured: true, answer, sources };
}

const askOpenAI = (query) =>
  askOpenRouter('ChatGPT', process.env.OPENROUTER_CHATGPT_MODEL || 'openai/gpt-4o', query);

const askClaude = (query) =>
  askOpenRouter('Claude', process.env.OPENROUTER_CLAUDE_MODEL || 'anthropic/claude-sonnet-4.5', query);

/* Perplexity: native Sonar if a key is set (cleanest citations), otherwise
   fall back to OpenRouter's perplexity/sonar so it still runs on one key. */
async function askPerplexity(query) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    if (process.env.OPENROUTER_API_KEY) {
      return askOpenRouter('Perplexity', process.env.OPENROUTER_PERPLEXITY_MODEL || 'perplexity/sonar', query);
    }
    return { engine: 'Perplexity', configured: false };
  }

  const r = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || 'sonar',
      messages: [{ role: 'user', content: query }],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Perplexity ${r.status}`);

  const answer = data.choices?.[0]?.message?.content || '';
  const sources = data.citations || (data.search_results || []).map((s) => s.url).filter(Boolean);
  return { engine: 'Perplexity', configured: true, answer, sources };
}

/* Gemini: native Google grounding first (truest to Google), but if that key
   is missing or its grounding quota is exhausted, fall back to OpenRouter so
   the engine still returns a real result on the OpenRouter balance. */
async function askGemini(query) {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      return await askGeminiNative(key, query);
    } catch (err) {
      if (!process.env.OPENROUTER_API_KEY) throw err;
      // native failed (e.g. quota) -> fall through to OpenRouter
    }
  }
  if (process.env.OPENROUTER_API_KEY) {
    return askOpenRouter('Gemini', process.env.OPENROUTER_GEMINI_MODEL || 'google/gemini-flash-latest', query);
  }
  return { engine: 'Gemini', configured: false };
}

async function askGeminiNative(key, query) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini ${r.status}`);

  const cand = data.candidates?.[0];
  const answer = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c) => c.web?.uri).filter(Boolean);
  return { engine: 'Gemini', configured: true, answer, sources };
}

/* ---------- helpers ------------------------------------------------------- */

async function guard(engine, fn) {
  try {
    return await fn();
  } catch (err) {
    return { engine, configured: true, error: String(err && err.message || err).slice(0, 160) };
  }
}

function cleanDomain(url) {
  return String(url || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

function trimText(t, max = 320) {
  const s = String(t).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
