const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.BIOSCRIPTZ_MODEL || 'claude-sonnet-5-5';

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your environment before running a research pass.');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SOURCING_RULES = `Sourcing rules (follow exactly — this tool refuses to ship unverified claims):
- Every factual statement (a claim, a number, a quote, a price, a review theme) must carry a "source" field.
- A source is either a real URL you found with the web_search tool, or the literal string "Document: <filename>" when it comes from an uploaded file you were given.
- Never invent a URL, a statistic, a quote, or a username. If you cannot find or verify something, write the value as "Not found" and set "source" to "none — not verified".
- Do not estimate frequencies, percentages, or counts unless they come directly from a source; otherwise say "unknown".
- Prefer the uploaded documents first; use web_search only to fill gaps or verify, and say which you used.
- Output ONLY one JSON object, inside a single \`\`\`json fenced block, matching the requested schema exactly. No prose outside the fence.`;

async function runStage({ system, prompt, useSearch = true, maxTokens = 4000 }) {
  const anthropic = client();
  const tools = useSearch
    ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }]
    : undefined;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: `${system}\n\n${SOURCING_RULES}`,
    tools,
    messages: [{ role: 'user', content: prompt }]
  });

  const sources = [];
  let text = '';
  for (const block of res.content) {
    if (block.type === 'text') text += block.text;
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.url) sources.push({ url: r.url, title: r.title || r.url });
      }
    }
  }

  return { text, sources, raw: res };
}

function parseJson(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
  const body = match ? match[1] : text;
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new Error(`Model did not return parseable JSON: ${err.message}\n---\n${body.slice(0, 500)}`);
  }
}

module.exports = { runStage, parseJson, MODEL };
