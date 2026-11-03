const { randomUUID } = require('crypto');
const { runStage, parseJson } = require('./anthropic');

// In-memory run store. Fine for a single-process demo/dev deployment;
// swap for a real DB/queue before putting this behind multiple server instances.
const runs = new Map();
const order = []; // run ids, most recent first

function getRun(id) {
  const run = runs.get(id);
  if (!run) throw new Error('Unknown run id');
  return run;
}

function log(run, text) {
  run.log.push({ t: Date.now(), text });
}

function docBlock(docs) {
  if (!docs.length) return '(No documents were uploaded for this run. Rely on web_search and say so.)';
  return docs.map(d => `--- Document: ${d.filename} ---\n${d.text}`).join('\n\n');
}

async function stageCompetitors(run) {
  log(run, 'Researching direct competitors');
  const { text, sources } = await runStage({
    system: `You are a market research analyst building a sourced competitor table for the brand "${run.brand}"${run.domain ? ` (${run.domain})` : ''}.`,
    prompt: `Identify up to 5 real, named direct competitors for this brand. For each, give: name, website, positioning, hero_product, price_range, ad_hooks_and_angles (what you actually found in their marketing), customer_praise, customer_complaints, unclaimed_gap, source.
Use the uploaded documents below first, then web_search to verify or fill gaps.

${docBlock(run.docs)}

Return JSON: {"competitors": [{"name":"","website":"","positioning":"","hero_product":"","price_range":"","ad_hooks_and_angles":"","customer_praise":"","customer_complaints":"","unclaimed_gap":"","source":""}]}`
  });
  const data = parseJson(text);
  run.sheets.competitors = { rows: data.competitors || [], sources };
  log(run, `Found ${(data.competitors || []).length} sourced competitors`);
}

async function stageBrandProduct(run) {
  log(run, 'Researching the brand\'s own product line and reputation');
  const { text, sources } = await runStage({
    system: `You are a product researcher documenting what "${run.brand}"${run.domain ? ` (${run.domain})` : ''} actually sells and how real customers talk about it.`,
    prompt: `List the brand's real products/SKUs you can verify. For each: product_name, price, key_claim, features, review_summary (with real counts/ratings only if you found them, else "unknown"), review_themes_positive, review_themes_negative, source.

${docBlock(run.docs)}

Return JSON: {"products": [{"product_name":"","price":"","key_claim":"","features":"","review_summary":"","review_themes_positive":"","review_themes_negative":"","source":""}]}`
  });
  const data = parseJson(text);
  run.sheets.products = { rows: data.products || [], sources };
  log(run, `Documented ${(data.products || []).length} sourced products`);
}

async function stageMarketCustomer(run) {
  log(run, 'Pulling real customer language (reviews, forums, comments)');
  const { text, sources } = await runStage({
    system: `You are gathering verbatim customer language about "${run.brand}" and its category — real quotes with real sources only.`,
    prompt: `Find real customer quotes (pain points, desires, objections, praise, complaints) about this brand or its category. Do not paraphrase into something punchier — keep wording close to the source. For each: source_platform, quote_type (pain|desire|objection|praise|complaint), quote, theme, source.

${docBlock(run.docs)}

Return JSON: {"quotes": [{"source_platform":"","quote_type":"","quote":"","theme":"","source":""}]}`
  });
  const data = parseJson(text);
  run.sheets.quotes = { rows: data.quotes || [], sources };
  log(run, `Collected ${(data.quotes || []).length} sourced customer quotes`);
}

async function stageOutliers(run) {
  log(run, 'Checking for provided social/content performance data');
  const hasPerfDocs = run.docs.length > 0;
  if (!hasPerfDocs) {
    run.sheets.outliers = {
      rows: [],
      note: 'No social performance data was provided and this tool does not fabricate view counts or reel links. Attach an export (Instagram/TikTok insights, Meta Ad Library report, a spreadsheet of past post performance) to populate this sheet.'
    };
    log(run, 'Skipped — no performance data provided, nothing invented');
    return;
  }
  const { text, sources } = await runStage({
    system: `You extract real, cited video performance data for "${run.brand}" from the documents provided. Never invent numbers.`,
    prompt: `From the uploaded documents only, extract any real posts/videos with verifiable performance data (views, likes, link, creator, date). If a document doesn't contain this, say so — do not estimate.

${docBlock(run.docs)}

Return JSON: {"outliers": [{"creator":"","link":"","views":"","likes":"","date":"","why_it_worked":"","source":""}], "coverage_note":""}`,
    useSearch: false
  });
  const data = parseJson(text);
  run.sheets.outliers = { rows: data.outliers || [], note: data.coverage_note || '', sources };
  log(run, `Extracted ${(data.outliers || []).length} documented posts from your files`);
}

async function stageAudience(run) {
  log(run, 'Mapping the 5 awareness stages from gathered evidence');
  const quotesCtx = JSON.stringify(run.sheets.quotes.rows);
  const stage1 = await runStage({
    system: `You build an awareness-stage map strictly from the evidence already gathered for "${run.brand}". Cite which quote/source backs each stage.`,
    prompt: `Using these collected customer quotes, group them into the 5 awareness stages (Problem unaware, Problem aware, Solution aware, Product aware, Most aware). For each stage give: description, who_is_here, evidence (cite the quote text and its source from the list below — do not invent new quotes).

Collected quotes:
${quotesCtx}

Return JSON: {"stages": [{"stage":"","description":"","who_is_here":"","evidence":""}]}`,
    useSearch: false
  });
  run.sheets.awareness = { rows: parseJson(stage1.text).stages || [] };

  log(run, 'Writing audience personas from the same evidence');
  const stage2 = await runStage({
    system: `You write audience personas for "${run.brand}" grounded only in the gathered quotes/evidence — no invented demographics beyond what the evidence implies.`,
    prompt: `From this awareness map and the quotes behind it, write up to 5 personas. For each: name_label, awareness_stage, pains, desires, objections, evidence_source (which quote(s)/source back this persona).

Awareness map:
${JSON.stringify(run.sheets.awareness.rows)}

Quotes:
${quotesCtx}

Return JSON: {"personas": [{"name_label":"","awareness_stage":"","pains":"","desires":"","objections":"","evidence_source":""}]}`,
    useSearch: false
  });
  run.sheets.personas = { rows: parseJson(stage2.text).personas || [] };
  log(run, `Built ${run.sheets.awareness.rows.length} awareness stages and ${run.sheets.personas.rows.length} personas`);
}

async function stageIdeation(run) {
  log(run, 'Drafting content ideas grounded in the research so far');
  const { text } = await runStage({
    system: `You draft content ideas for "${run.brand}" using only the positioning gaps, product claims, customer language and (if present) documented performance patterns already gathered. Cite which earlier sheet/source informed each idea — do not claim a format "goes viral" unless that's backed by outlier data you were given.`,
    prompt: `Research so far:
Competitors/gaps: ${JSON.stringify(run.sheets.competitors.rows)}
Products/claims: ${JSON.stringify(run.sheets.products.rows)}
Personas: ${JSON.stringify(run.sheets.personas.rows)}
Documented outliers (may be empty): ${JSON.stringify(run.sheets.outliers.rows)}

Draft up to 6 content ideas. For each: format, angle, hook, core_message, proof_point (must reference a real product claim/review/quote above), cta, target_persona, basis (which sheet/source this idea is grounded in).

Return JSON: {"ideas": [{"format":"","angle":"","hook":"","core_message":"","proof_point":"","cta":"","target_persona":"","basis":""}]}`,
    useSearch: false
  });
  run.sheets.ideas = { rows: parseJson(text).ideas || [], approved: [] };
  log(run, `Drafted ${run.sheets.ideas.rows.length} ideas — waiting for your approval`);
}

async function stageScripts(run) {
  const approvedIdx = run.sheets.ideas.approved;
  const approved = approvedIdx.map(i => run.sheets.ideas.rows[i]).filter(Boolean);
  log(run, `Writing scripts for ${approved.length} approved idea(s)`);
  if (!approved.length) {
    run.sheets.scripts = { rows: [] };
    return;
  }
  const { text } = await runStage({
    system: `You write shoot-ready scripts for "${run.brand}" for only the approved ideas below. Every claim in the script must trace back to a proof_point already established — do not add new unverified claims.`,
    prompt: `Approved ideas:
${JSON.stringify(approved)}

For each, write: idea_ref (its hook), duration_sec, beats (array of {time, action, line}), shot_list, tone_notes, basis (restate the proof point/source this script relies on).

Return JSON: {"scripts": [{"idea_ref":"","duration_sec":0,"beats":[{"time":"","action":"","line":""}],"shot_list":"","tone_notes":"","basis":""}]}`,
    useSearch: false,
    maxTokens: 6000
  });
  run.sheets.scripts = { rows: parseJson(text).scripts || [] };
  log(run, `Wrote ${run.sheets.scripts.rows.length} scripts`);
}

async function stagePresentation(run) {
  log(run, 'Compiling the presentation pack and source list');
  const allSources = [];
  for (const key of ['competitors', 'products', 'quotes', 'outliers']) {
    for (const s of (run.sheets[key]?.sources || [])) allSources.push(s);
  }
  run.sheets.presentation = {
    summary: {
      brand: run.brand,
      domain: run.domain || null,
      competitors_found: run.sheets.competitors.rows.length,
      products_documented: run.sheets.products.rows.length,
      quotes_collected: run.sheets.quotes.rows.length,
      ideas_approved: run.sheets.ideas.approved.length,
      scripts_written: run.sheets.scripts.rows.length
    },
    sources: allSources
  };
  log(run, 'Workbook ready');
}

async function execute(run) {
  try {
    run.status = 'running';
    run.stage = 'research';
    await stageCompetitors(run);
    await stageBrandProduct(run);
    await stageMarketCustomer(run);
    await stageOutliers(run);

    run.stage = 'audience';
    await stageAudience(run);

    run.stage = 'ideation';
    await stageIdeation(run);

    run.stage = 'gate';
    run.status = 'waiting_for_approval';
    log(run, 'Paused — approve ideas to continue to scripting');
    await new Promise(resolve => { run.resumeGate = resolve; });

    run.status = 'running';
    run.stage = 'script';
    await stageScripts(run);

    run.stage = 'presentation';
    await stagePresentation(run);

    run.status = 'done';
    log(run, 'Run complete');
  } catch (err) {
    run.status = 'error';
    run.error = err.message;
    log(run, `Error: ${err.message}`);
  }
}

function startRun({ brand, domain, docs }) {
  const id = randomUUID();
  const run = {
    id, brand, domain, docs,
    createdAt: Date.now(),
    status: 'running',
    stage: 'research',
    log: [],
    sheets: {},
    resumeGate: null
  };
  runs.set(id, run);
  order.unshift(id);
  execute(run); // fire and forget; client polls /api/run/:id
  return id;
}

function listRuns(limit = 20) {
  return order.slice(0, limit).map(id => {
    const r = runs.get(id);
    return { id: r.id, brand: r.brand, domain: r.domain, status: r.status, createdAt: r.createdAt };
  });
}

function approveIdeas(id, approvedIdx) {
  const run = getRun(id);
  if (run.status !== 'waiting_for_approval') {
    throw new Error(`Run is not waiting for approval (status: ${run.status})`);
  }
  run.sheets.ideas.approved = approvedIdx;
  const resume = run.resumeGate;
  run.resumeGate = null;
  resume();
  return run;
}

function toPublic(run) {
  return {
    id: run.id,
    brand: run.brand,
    domain: run.domain,
    createdAt: run.createdAt,
    status: run.status,
    stage: run.stage,
    log: run.log,
    sheets: run.sheets,
    error: run.error || null
  };
}

module.exports = { startRun, getRun, approveIdeas, toPublic, listRuns };
