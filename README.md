# Bioscriptz

Type a brand name, company name, or domain. Optionally attach your own market-research,
competitor-research, or past content-performance documents. Bioscriptz runs real research
(your documents first, then live web search) and produces:

1. Competitor Research
2. Brand & Product
3. Market & Customer language
4. Outlier / performance data (only populated from documents you provide — never invented)
5. Awareness Map
6. Audience Avatars
7. Ideation (you approve ideas before scripts are written)
8. Scripts
9. Presentation Pack + full source list

**Every claim ships with a source** — a real URL found via web search, or `Document: <filename>`
for something pulled from your upload. Anything that can't be verified is labeled `Not found`
rather than invented. No category is guessed from the brand name; nothing runs until you type one.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY
npm start
```

Open http://localhost:3000.

## How it works

- `server/index.js` — Express app, file upload endpoint, run status/approval endpoints.
- `server/documents.js` — extracts text from uploaded PDF/DOCX/TXT/MD/CSV files.
- `server/anthropic.js` — calls the Anthropic API with the `web_search` tool and enforces the
  sourcing rules in the system prompt (cite everything, or say "Not found").
- `server/pipeline.js` — runs the 9 sheets as a sequence of model calls, pausing after ideation
  for your approval before writing scripts.
- `public/` — static frontend that starts a run, polls progress, shows the approval gate, and
  renders every sheet with its sources.

## Notes / limits

- There is no live Instagram/TikTok API integration — the "outlier/performance data" sheet is
  only filled from documents you upload (e.g. a platform insights export). It will say so if
  you don't provide one, instead of making up view counts.
- Runs are kept in memory in a single process. Fine for local use or a single small deployment;
  swap in a real datastore before scaling this out.
