# vouchaeo

Marketing site for vouchaeo — Answer Engine Optimization (AEO) for staffing agencies.

Built from the Figma design at
`figma.com/design/jLcy2qGbBa9tAFZA8hw8rf` (node `1:10981`) on a 1432px canvas.

## Stack

Static HTML, CSS and vanilla JS — no build step. Open `index.html`, or serve the
folder over HTTP so the assets resolve:

```sh
python3 -m http.server 4173
```

There is also a `.claude/launch.json` that starts the same server on port 4173.

## Layout

```
index.html    markup for every section, the modals and the cookie banner
styles.css    design tokens, section styles, and the responsive layer
app.js        rotator, simulator, chart, agent tabs, wizard, cookie consent
assets/       imagery and icons exported from Figma, plus AI platform marks
1–6.png       agent-stack artwork, one per highlighted module
```

## Sections

Header · Hero (rotating AI-platform lockup, signal illustration) · See AEO in
action (side-by-side answer-engine simulator) · The paradigm shift (animated
click-through chart) · The Six AI Agents · FAQ · Closing CTA · Footer.

## Interactions

- Hero lockup cycles ChatGPT → Perplexity → Gemini → Claude → Grok every 2s
- Simulator tabs replay a staged reveal of the with/without answer
- Chart bars grow up the y-axis when the section scrolls into view
- Agent rows swap the stacked-module artwork (a tab strip on phones)
- Multi-step Book a Demo wizard with per-step validation
- Privacy, Terms and Cookie Settings modals; consent persists in `localStorage`

## Responsive

Breakpoints at 1432 / 1180 / 860 / 680px. Below 1180 the pinned compositions
unpin and flow, and the desktop nav is replaced by a hamburger menu.

## Third-party marks

The Perplexity, Claude and Gemini glyphs in `assets/` come from
[Simple Icons](https://simpleicons.org) (CC0). The ChatGPT and Grok marks are
hand-authored, since Simple Icons does not carry them. All are used to identify
the platforms the product optimizes for.

## Live AI visibility check (`api/check.js`)

The "See if AI recommends you" popup posts to a Vercel serverless function that
queries the AI engines and reports, per engine, whether the firm is **named** in
the answer and whether its **domain is cited** in the sources.

### Routing (hybrid)

| Engine | Route | Env var |
|---|---|---|
| ChatGPT | OpenRouter (web plugin) | `OPENROUTER_API_KEY` |
| Claude | OpenRouter (web plugin) | `OPENROUTER_API_KEY` |
| Gemini | Native Google Search grounding | `GEMINI_API_KEY` |
| Perplexity | Native Sonar, else OpenRouter fallback | `PERPLEXITY_API_KEY` (optional) |

### Setup

Set the keys in **Vercel → Project → Settings → Environment Variables**, then
redeploy. Never commit keys — `.env*` is gitignored.

Minimum to run all four engines: `OPENROUTER_API_KEY` + `GEMINI_API_KEY`
(Perplexity then runs through OpenRouter). Add `PERPLEXITY_API_KEY` for its most
citation-accurate native path.

Any engine without a key returns `configured:false` and the UI shows
"Not connected" — it never invents a result. On `localhost` (no serverless
runtime) the popup shows a clearly-labelled demo so the UI stays testable.

Optional model overrides: `OPENROUTER_CHATGPT_MODEL` (default `openai/gpt-4o`),
`OPENROUTER_CLAUDE_MODEL` (default `anthropic/claude-3.5-sonnet`),
`OPENROUTER_PERPLEXITY_MODEL` (default `perplexity/sonar`),
`GEMINI_MODEL` (default `gemini-2.0-flash`), `PERPLEXITY_MODEL` (default `sonar`).
