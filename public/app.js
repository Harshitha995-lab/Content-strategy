const $=(s,el=document)=>el.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pad=n=>String(n).padStart(2,'0');
const chip=(t,c)=>`<span class="chip" style="--c:var(--${c})">${esc(t)}</span>`;
const L=x=>`<div class="cl">${x}</div>`, M=x=>`<div class="cm">${x}</div>`;

function srcTag(s){
  if(!s) return '<span class="unverified">no source</span>';
  if(/^https?:\/\//i.test(s)) return `<a class="lnk" href="${esc(s)}" target="_blank" rel="noopener noreferrer" data-act="open-src" data-url="${esc(s)}">Open source ↗</a>`;
  if(/^document:/i.test(s)) return `<span class="chip" style="--c:var(--sky)">${esc(s)}</span>`;
  if(/not found|none|not verified/i.test(s)) return `<span class="unverified">${esc(s)}</span>`;
  return esc(s);
}

const STEPS=[
 {n:'Research',c:'sky',sheets:[0,1,2,3],stage:'research',blurb:'Competitors, your brand, customers, and whatever performance data you provided.'},
 {n:'Audience avatar',c:'pink',sheets:[4,5],stage:'audience',blurb:'Five awareness stages and who sits in each, built only from gathered evidence.'},
 {n:'Ideation',c:'yellow',sheets:[6],stage:'ideation',blurb:'Formats, angles, hooks and proof, grounded in the research. You approve before scripting.'},
 {n:'Script',c:'mint',sheets:[7],stage:'script',blurb:'Shoot-ready scripts for approved ideas only, with every line traceable to a source.'},
 {n:'Presentation',c:'orange',sheets:[8],stage:'presentation',blurb:'One pack for brand review, plus the full source list.'}];
const SHEETS=['Competitor Research','Brand & Product','Market & Customer','Outlier Data','Awareness Map','Audience Avatars','Ideation SOP','Script & Storyboard','Presentation Pack'];
const stepOf=i=>STEPS.findIndex(s=>s.sheets.includes(i));
const stepOfStage=stage=>STEPS.findIndex(s=>s.stage===stage);
const SUBS=[
 ['Competitor research','Brand & product research','Market & customer research','Outlier / performance data'],
 ['Grouping findings by awareness stage','Writing audience avatars'],
 ['Drafting formats, angles, hooks and proof'],
 ['Writing scripts for approved ideas'],
 ['Assembling the workbook and source list']];

/* ---------- state ---------- */
const S={view:'start',files:[],runId:null,poll:null,run:null,sheet:0,script:0,recent:[]};

/* ---------- top bar ---------- */
function renderTop(){
 const hasBook=S.run&&Object.keys(S.run.sheets||{}).length>0;
 $('#topbar').innerHTML=`<button class="logo" data-act="nav" data-v="start" aria-label="Bioscriptz home"><span class="mark">B</span>Bioscriptz</button>
 <span class="pill" style="background:var(--mint)">Real research · cited</span>
 <nav class="nav"><button class="btn sm" data-act="brand" aria-haspopup="dialog">Brand colors</button>
 <button class="btn sm ${S.view==='start'?'on':''}" data-act="nav" data-v="start">New run</button>
 <button class="btn sm ${S.view==='book'?'on':''}" data-act="nav" data-v="book" ${hasBook?'':'disabled'}>Workbook</button></nav>`;
}

/* ---------- start screen ---------- */
async function loadRecent(){
 try{const r=await fetch('/api/runs');S.recent=await r.json()}catch(e){S.recent=[]}
}
function fmtWhen(ts){const d=Date.now()-ts;const m=Math.round(d/60000);if(m<1)return'just now';if(m<60)return m+'m ago';const h=Math.round(m/60);if(h<24)return h+'h ago';return Math.round(h/24)+'d ago'}

function renderStart(){
 $('#app').innerHTML=`<section class="hero">
 <span class="pill" style="width:fit-content;background:var(--mint);color:var(--on)">5 steps · 9 sheets · every claim cited</span>
 <h1>Type a brand. Get <span class="hl" style="background:var(--pink)">real</span>, <span class="hl" style="background:var(--yellow);transform:rotate(1.2deg)">sourced</span> strategy.</h1>
 <p>Research, audience mapping, ideation, and shoot-ready scripts — grounded in your documents and live web search. Nothing is invented: every claim links to a source, or says it couldn't be verified.</p>
 <div class="runbox">
   <input id="brandInput" type="text" autocomplete="off" placeholder="Brand name, company name, or domain, e.g. acme.com" aria-label="Brand name, company name, or domain">
   <button class="btn icon" id="attachBtn" title="Attach research documents" aria-label="Attach research documents">📎 Attach research</button>
   <button class="btn pri" data-act="run">Run the research</button>
 </div>
 <div class="chips" id="fileChips"></div>
 <p class="muted" id="fileHint" style="font-size:12.5px;margin:0">Optional: your market research, competitor research, audience research, or past content-performance exports (PDF, DOCX, TXT, CSV, MD). These are used before anything from the web.</p>
 </section>
 <section class="sec"><h2>What happens when you hit run</h2><div class="five">${STEPS.map((s,i)=>`<div class="card tint" style="--c:var(--${s.c})"><span class="num" style="--c:var(--${s.c})">${i+1}</span><h3>${s.n}</h3><p>${s.blurb}</p></div>`).join('')}</div></section>
 <section class="sec"><h2>Your workbook, sheet by sheet</h2><div class="tiles">${SHEETS.map((n,i)=>`<div class="tile tint" style="--c:var(--${STEPS[stepOf(i)].c})"><b>${i+1}</b>${n}</div>`).join('')}</div></section>
 <section class="sec" style="padding-bottom:36px"><h2>Recent runs</h2><div class="recent" id="recentList">${renderRecent()}</div></section>`;
 const inp=$('#brandInput');
 inp.addEventListener('keydown',e=>{if(e.key==='Enter')startRun()});
 $('#attachBtn').addEventListener('click',()=>$('#fileInput').click());
 renderFileChips();
}
function renderRecent(){
 if(!S.recent.length)return `<p class="muted">No runs yet this session.</p>`;
 return S.recent.map(r=>`<div class="rrow"><div class="grow"><b>${esc(r.brand)}</b> <span class="muted">· ${fmtWhen(r.createdAt)}</span></div>${chip(r.status,r.status==='done'?'mint':r.status==='error'?'pink':'yellow')}<button class="btn sm" data-act="open-recent" data-id="${r.id}">Open</button></div>`).join('');
}
function renderFileChips(){
 const el=$('#fileChips');if(!el)return;
 el.innerHTML=S.files.map((f,i)=>`<span class="filechip">${esc(f.name)}<button data-act="rm-file" data-i="${i}" aria-label="Remove ${esc(f.name)}">×</button></span>`).join('');
}

/* ---------- run ---------- */
async function startRun(){
 const v=($('#brandInput')?.value||'').trim();
 if(!v){const i=$('#brandInput');i.classList.remove('shake');void i.offsetWidth;i.classList.add('shake');i.focus();toast('Type a brand, company name, or domain first.');return}
 const fd=new FormData();fd.append('brand',v);S.files.forEach(f=>fd.append('documents',f));
 S.view='run';S.run=null;S.sheet=0;S.script=0;render();
 const resp=await fetch('/api/run',{method:'POST',body:fd});
 const data=await resp.json();
 if(!resp.ok){toast(data.error||'Could not start the run');S.view='start';render();return}
 S.runId=data.id;S.files=[];
 clearInterval(S.poll);S.poll=setInterval(pollRun,1200);
 pollRun();
}
async function pollRun(){
 if(!S.runId)return;
 const resp=await fetch(`/api/run/${S.runId}`);
 const run=await resp.json();
 if(!resp.ok){toast(run.error||'Run not found');clearInterval(S.poll);return}
 S.run=run;
 if(run.status==='done'){clearInterval(S.poll);S.view='book';S.sheet=0;render();toast('Workbook ready');return}
 if(run.status==='error'){clearInterval(S.poll);render();return}
 if(S.view==='run')renderRun();
 else render();
}
async function approveGate(approvedIdx){
 await fetch(`/api/run/${S.runId}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approvedIdx})});
 pollRun();
}
function renderRun(){
 if(!S.run){$('#app').innerHTML=`<div class="card">Starting...</div>`;return}
 const run=S.run,curStep=stepOfStage(run.stage),gate=run.status==='waiting_for_approval';
 const cards=STEPS.map((st,i)=>{
  const done=i<curStep||(i===curStep&&!gate&&run.status==='done');
  const running=i===curStep&&!gate&&run.status!=='error';
  const status=done?chip('Done','mint'):running?chip('Working','yellow'):(i===curStep&&gate?chip('Needs you','pink'):chip('Queued','surface2'));
  return `<div class="card stepc ${(!done&&!running&&!(i===curStep&&gate))?'queued':''}"><div class="hd"><span class="num" style="--c:var(--${st.c})">${i+1}</span><h3>${st.n}</h3><span style="margin-left:auto">${status}</span></div>
  <ul class="subs">${SUBS[i].map(t=>{const d=i<curStep;const r=i===curStep;return `<li><span class="dot ${d?'d':r?'r':''}">${d?'✓':''}</span><span class="${d||r?'':'muted'}">${esc(t)}</span></li>`}).join('')}</ul></div>`}).join('');
 const ideas=run.sheets.ideas?.rows||[];
 const gateHtml=gate?`<div class="card gate" style="grid-column:1/-1"><div><h3 style="font-size:22px">Your turn: approve the ideas you'd shoot</h3><p class="muted" style="margin:4px 0 0">Scripts are only written for approved ideas. Each idea shows what research it's grounded in.</p></div>
  <div style="display:grid;gap:8px">${ideas.map((x,i)=>ideaRow(x,i,true)).join('')}</div>
  <div class="row"><button class="btn go" id="gateGo">Approve selected and write scripts</button><button class="btn sm" id="gateAll">Select all</button><button class="btn sm" id="gateNone">Clear</button></div></div>`:'';
 const errHtml=run.status==='error'?`<div class="card tint" style="--c:var(--pink);grid-column:1/-1"><b>Run failed:</b> ${esc(run.error)}</div>`:'';
 $('#app').innerHTML=`<div class="runlay"><div class="steps"><div class="card tint" style="--c:var(--violet)"><div class="row"><h2 style="font-size:26px">Running for ${esc(run.brand)}</h2></div><p class="muted" style="margin:4px 0 0">Live research — this can take a minute per stage.</p></div>${cards}</div>
 <div style="display:grid;gap:18px"><div class="term" aria-live="polite">${run.log.map(l=>`<div><span class="t">${new Date(l.t).toLocaleTimeString()}</span> ${esc(l.text)}</div>`).join('')}<div class="t">▌</div></div></div>${gateHtml}${errHtml}</div>`;
 if(gate){
  $('#gateGo').onclick=()=>{const idx=[...document.querySelectorAll('.ideaChk')].filter(c=>c.checked).map(c=>+c.dataset.i);approveGate(idx)};
  $('#gateAll').onclick=()=>document.querySelectorAll('.ideaChk').forEach(c=>c.checked=true);
  $('#gateNone').onclick=()=>document.querySelectorAll('.ideaChk').forEach(c=>c.checked=false);
 }
}
function ideaRow(x,i,checked){return `<label class="idea"><input type="checkbox" class="ideaChk" data-i="${i}" ${checked?'checked':''}><span class="g"><b>${esc(x.hook)}</b><span class="row">${chip(x.format||'','sky')}${chip(x.angle||'','pink')}</span><span class="muted" style="font-size:12.5px">${esc(x.core_message||'')}</span><span class="muted" style="font-size:11.5px">Basis: ${esc(x.basis||'unspecified')}</span></span></label>`}

/* ---------- workbook ---------- */
function renderBook(){
 const run=S.run;
 if(!run){S.view='start';renderStart();return}
 const st=stepOf(S.sheet),STP=STEPS[st];
 $('#app').innerHTML=`<div class="bookhd"><div class="grow"><h2>${esc(run.brand)}</h2><span class="muted">${(run.sheets.ideas?.approved||[]).length} approved ideas · ${new Date(run.createdAt||Date.now()).toLocaleString()}</span></div>
 <button class="btn hot" data-act="share">Share with brand</button><a class="btn go" href="/api/run/${run.id}/export.xlsx" download>Export .xlsx</a></div>
 <div class="strip">${STEPS.map((s,i)=>`<button class="sp" data-act="step" data-i="${i}" style="--c:var(--${s.c})" aria-current="${i===st}"><small>STEP ${i+1}</small><b>${s.n}</b></button>`).join('')}</div>
 <div class="sheet" style="--st:var(--${STP.c})">${[sheet1,sheet2,sheet3,sheet4,sheet5,sheet6,sheet7,sheet8,sheet9][S.sheet](run)}</div>
 <div class="tabs"><div class="tabsin" role="tablist">${SHEETS.map((n,i)=>`<button class="tab" role="tab" data-act="sheet" data-i="${i}" aria-selected="${i===S.sheet}" style="--c:var(--${STEPS[stepOf(i)].c})"><i></i>${i+1} · ${esc(n)}</button>`).join('')}</div></div>`;
}
const tbl=(cols,rows,rowAttr)=>rows.length?`<div class="tw"><table><thead><tr><th class="rn"></th>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr ${rowAttr?rowAttr(i):''}><td class="rn">${i+1}</td>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<div class="empty">Nothing here yet for this run.</div>`;
const head=(n,sub)=>`<div class="shd"><h3>Sheet ${n+1} · ${esc(SHEETS[n])}</h3>${chip('Step '+(stepOf(n)+1)+' · '+STEPS[stepOf(n)].n,STEPS[stepOf(n)].c)}<span class="grow muted" style="text-align:right">${esc(sub)}</span></div>`;

function sheet1(run){const rows=run.sheets.competitors?.rows||[];
 return head(0,'Real, named competitors — every field cited')+tbl(['Competitor','Website','Positioning','Hero product','Price','Ad hooks/angles','Praise','Complaints','Gap','Source'],
 rows.map(r=>[`<b>${esc(r.name)}</b>`,M(esc(r.website)),M(esc(r.positioning)),M(esc(r.hero_product)),esc(r.price_range),L(esc(r.ad_hooks_and_angles)),M(esc(r.customer_praise)),M(esc(r.customer_complaints)),L(esc(r.unclaimed_gap)),srcTag(r.source)]),i=>`data-act="row" data-sheet="competitors" data-i="${i}"`);}

function sheet2(run){const rows=run.sheets.products?.rows||[];
 return head(1,'What the brand actually sells, sourced')+tbl(['Product','Price','Key claim','Features','Reviews','+ themes','- themes','Source'],
 rows.map(r=>[`<b>${esc(r.product_name)}</b>`,esc(r.price),M(esc(r.key_claim)),M(esc(r.features)),M(esc(r.review_summary)),M(esc(r.review_themes_positive)),M(esc(r.review_themes_negative)),srcTag(r.source)]),i=>`data-act="row" data-sheet="products" data-i="${i}"`);}

function sheet3(run){const rows=run.sheets.quotes?.rows||[];
 const col={pain:'pink',desire:'mint',objection:'yellow',praise:'sky',complaint:'orange'};
 return head(2,'Verbatim customer language, sourced')+tbl(['Platform','Type','Exact words','Theme','Source'],
 rows.map(r=>[esc(r.source_platform),chip(r.quote_type||'',col[r.quote_type]||'surface2'),L(`<span class="q">${esc(r.quote)}</span>`),M(esc(r.theme)),srcTag(r.source)]),i=>`data-act="row" data-sheet="quotes" data-i="${i}"`);}

function sheet4(run){const o=run.sheets.outliers;const rows=o?.rows||[];
 const note=o?.note?`<div class="note">${esc(o.note)}</div>`:'';
 return head(3,'Only populated from documents you provided — nothing invented')+note+tbl(['Creator','Link','Views','Likes','Date','Why it worked','Source'],
 rows.map(r=>[esc(r.creator),r.link?`<a class="lnk" href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.link)}</a>`:'',esc(r.views),esc(r.likes),esc(r.date),M(esc(r.why_it_worked)),srcTag(r.source)]),i=>`data-act="row" data-sheet="outliers" data-i="${i}"`);}

function sheet5(run){const rows=run.sheets.awareness?.rows||[];
 const col=['pink','orange','yellow','mint','sky'];
 return head(4,'Built only from the evidence gathered, not demographic guesses')+tbl(['Awareness stage','Description','Who is here','What creative must do'],
 rows.map((r,i)=>[`<span class="stage" style="--c:var(--${col[i%5]})">${esc(r.stage)}</span>`,L(esc(r.description)),L(esc(r.who_is_here)),L(esc(r.evidence))]),i=>`data-act="row" data-sheet="awareness" data-i="${i}"`);}

function sheet6(run){const rows=run.sheets.personas?.rows||[];
 return head(5,'Personas grounded in the quotes behind them')+tbl(['Persona','Stage','Pains','Desires','Objections','Evidence'],
 rows.map(r=>[`<b>${esc(r.name_label)}</b>`,chip(r.awareness_stage||'','sky'),M(esc(r.pains)),M(esc(r.desires)),M(esc(r.objections)),L(esc(r.evidence_source))]),i=>`data-act="row" data-sheet="personas" data-i="${i}"`);}

function sheet7(run){const rows=run.sheets.ideas?.rows||[];const approved=new Set(run.sheets.ideas?.approved||[]);
 return head(6,'Each idea traces back to a source')+tbl(['Format','Angle','Hook','Message','Proof','CTA','Persona','Basis','Status'],
 rows.map((x,i)=>[M(esc(x.format)),chip(x.angle||'','pink'),L(esc(x.hook)),L(esc(x.core_message)),M(esc(x.proof_point)),M(esc(x.cta)),M(esc(x.target_persona)),L(esc(x.basis)),approved.has(i)?chip('Approved','mint'):chip('Not approved','surface2')]),i=>`data-act="row" data-sheet="ideas" data-i="${i}"`);}

function sheet8(run){const rows=run.sheets.scripts?.rows||[];
 if(!rows.length)return head(7,'Scripts for approved ideas')+`<div class="empty"><b>No scripts yet.</b><br>Approve ideas during the run and scripts appear here once that stage finishes.</div>`;
 S.script=Math.min(S.script,rows.length-1);const sc=rows[S.script];
 return `<div class="shd"><div class="sheettitle">shoot flows</div>${chip('Step 4 · Script','mint')}</div>
 <div class="chips">${rows.map((y,i)=>`<button class="btn sm ${i===S.script?'on':''}" data-act="script" data-i="${i}">S-${pad(i+1)}</button>`).join('')}</div>
 <div class="hdrgrid">${[['Idea',sc.idea_ref],['Duration',sc.duration_sec+' sec'],['Shot list',sc.shot_list],['Tone notes',sc.tone_notes],['Basis',sc.basis]].map(a=>`<div class="kv"><small>${esc(a[0])}</small><div>${esc(a[1])}</div></div>`).join('')}</div>
 <div class="tw"><table><thead><tr><th>#</th><th>Time</th><th>Action</th><th>Line</th></tr></thead><tbody>${(sc.beats||[]).map((b,i)=>`<tr><td><span class="chip" style="--c:var(--sky)">${i+1}</span></td><td class="mono">${esc(b.time)}</td><td>${esc(b.action)}</td><td>${b.line?`<span class="q">"${esc(b.line)}"</span>`:''}</td></tr>`).join('')}</tbody></table></div>`;}

function sheet9(run){const p=run.sheets.presentation;
 if(!p)return head(8,'The sheet you hand to the brand')+`<div class="empty"><b>Not ready yet.</b><br>Finishes once the run completes.</div>`;
 const sum=Object.entries(p.summary).map(([k,v])=>[k.replace(/_/g,' '),String(v)]);
 return head(8,'The sheet you hand to the brand')+`<div class="hdrgrid">${sum.map(a=>`<div class="kv"><small>${esc(a[0])}</small><div><b>${esc(a[1])}</b></div></div>`).join('')}</div>`+
 `<h3 style="font-size:19px;margin-top:14px">All sources used in this run</h3>`+tbl(['Source'],(p.sources||[]).map(s=>[`<a class="lnk" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title||s.url)}</a>`]));}

/* ---------- drawer (generic row detail) ---------- */
function openDrawer(sheetKey,i){
 const rows=S.run?.sheets?.[sheetKey]?.rows||[];const row=rows[i];if(!row)return;
 const entries=Object.entries(row).filter(([k])=>k!=='source');
 $('#drawer').innerHTML=`<div class="row"><h3 style="font-size:20px;flex:1">Row detail</h3><button class="btn sm" data-act="close-drawer" aria-label="Close">Close</button></div>
 ${entries.map(([k,v])=>`<div class="seg"><small>${esc(k.replace(/_/g,' '))}</small><div>${Array.isArray(v)?esc(JSON.stringify(v)):esc(v)}</div></div>`).join('')}
 <div class="seg"><small>source</small><div>${srcTag(row.source)}</div></div>`;
 $('#drawer').classList.add('open');$('#drawer .btn').focus();
}
function closeDrawer(){$('#drawer').classList.remove('open')}

/* ---------- misc ---------- */
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800)}
function render(){renderTop();closeDrawer();if(S.view==='start'){loadRecent().then(renderStart)}else if(S.view==='run')renderRun();else renderBook();window.scrollTo({top:0})}
function keepScroll(fn){const y=window.scrollY;fn();window.scrollTo({top:y})}

document.addEventListener('click',e=>{
 const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;
 if(a==='nav'){const v=t.dataset.v;if(v==='start'){clearInterval(S.poll);S.view='start'}else if(S.run)S.view='book';render()}
 else if(a==='run')startRun();
 else if(a==='rm-file'){S.files.splice(+t.dataset.i,1);renderFileChips()}
 else if(a==='open-recent'){clearInterval(S.poll);S.runId=t.dataset.id;S.view='book';pollRun()}
 else if(a==='step'){S.sheet=STEPS[+t.dataset.i].sheets[0];render()}
 else if(a==='sheet'){S.sheet=+t.dataset.i;render()}
 else if(a==='row'){openDrawer(t.dataset.sheet,+t.dataset.i)}
 else if(a==='close-drawer')closeDrawer();
 else if(a==='script'){S.script=+t.dataset.i;keepScroll(renderBook)}
 else if(a==='brand')toggleBrand();
 else if(a==='brand-reset'){Object.assign(BR,BR0);applyBrand();saveBrand();fillBrand()}
 else if(a==='share'){const url=`${location.origin}${location.pathname}?run=${S.run.id}`;navigator.clipboard?.writeText(url).catch(()=>{});toast('Share link copied: '+url)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});

$('#fileInput').addEventListener('change',e=>{
 S.files=S.files.concat([...e.target.files]);
 e.target.value='';
 renderFileChips();
});

/* ---------- brand colours ---------- */
const BR0={violet:'#8057FF',pink:'#FF5FA8',yellow:'#FFD93D'},BR={...BR0};
const lum=h=>{const n=parseInt(h.slice(1),16);return(.299*(n>>16&255)+.587*(n>>8&255)+.114*(n&255))/255};
function applyBrand(){const s=document.documentElement.style;for(const k in BR)s.setProperty('--'+k,BR[k]);s.setProperty('--on-pri',lum(BR.violet)>.6?'#17132E':'#FFFFFF')}
function saveBrand(){try{localStorage.setItem('bioscriptz-brand',JSON.stringify(BR))}catch(e){}}
function loadBrand(){try{const j=JSON.parse(localStorage.getItem('bioscriptz-brand')||'null');if(j)for(const k in BR)if(/^#[0-9a-f]{6}$/i.test(j[k]||''))BR[k]=j[k]}catch(e){}}
function fillBrand(){for(const k in BR){$('#bc-'+k).value=BR[k];$('#bt-'+k).value=BR[k]}}
function toggleBrand(){const p=$('#brandpanel');p.hidden=!p.hidden;fillBrand()}
document.addEventListener('input',e=>{const t=e.target,k=t.dataset.brand||t.dataset.brandtext;if(!k)return;let v=t.value.trim();if(t.dataset.brandtext&&v[0]!=='#')v='#'+v;if(!/^#[0-9a-f]{6}$/i.test(v))return;BR[k]=v.toLowerCase();applyBrand();saveBrand();if(t.dataset.brand)$('#bt-'+k).value=BR[k];else $('#bc-'+k).value=BR[k]});

/* ---------- boot ---------- */
loadBrand();applyBrand();
(function boot(){
 const params=new URLSearchParams(location.search);
 const runParam=params.get('run');
 if(runParam){S.runId=runParam;S.view='book';pollRun()}
 else render();
})();
