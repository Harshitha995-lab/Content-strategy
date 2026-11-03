const ExcelJS = require('exceljs');

const SHEET_DEFS = [
  ['Competitor Research', 'competitors'],
  ['Brand & Product', 'products'],
  ['Market & Customer', 'quotes'],
  ['Outlier Data', 'outliers'],
  ['Awareness Map', 'awareness'],
  ['Audience Avatars', 'personas'],
  ['Ideation SOP', 'ideas'],
  ['Script & Storyboard', 'scripts'],
];

function flattenScript(rows) {
  return rows.map(r => ({
    idea_ref: r.idea_ref,
    duration_sec: r.duration_sec,
    beats: (r.beats || []).map(b => `${b.time}: ${b.action}${b.line ? ` — "${b.line}"` : ''}`).join(' | '),
    shot_list: r.shot_list,
    tone_notes: r.tone_notes,
    basis: r.basis
  }));
}

function addRowsSheet(wb, title, rows) {
  const ws = wb.addWorksheet(title.slice(0, 31));
  if (!rows.length) {
    ws.addRow(['No data for this run']);
    return;
  }
  const cols = Object.keys(rows[0]);
  ws.columns = cols.map(c => ({ header: c, key: c, width: 28 }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(cols.map(c => (r[c] == null ? '' : String(r[c]))));
}

async function buildWorkbook(run) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bioscriptz';
  wb.created = new Date();

  for (const [title, key] of SHEET_DEFS) {
    const sheetData = run.sheets[key];
    const rows = key === 'scripts' ? flattenScript(sheetData?.rows || []) : (sheetData?.rows || []);
    addRowsSheet(wb, title, rows);
  }

  const pres = run.sheets.presentation;
  addRowsSheet(wb, 'Presentation Pack', pres ? [pres.summary] : [{ note: 'Run not finished' }]);
  const sourceRows = (pres?.sources || []).map(s => ({ title: s.title, url: s.url }));
  addRowsSheet(wb, 'Sources', sourceRows.length ? sourceRows : [{ note: 'No sources recorded' }]);

  return wb.xlsx.writeBuffer();
}

module.exports = { buildWorkbook };
