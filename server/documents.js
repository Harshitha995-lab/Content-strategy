const fs = require('fs');
const path = require('path');

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf);
      return data.text;
    }
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    // txt, md, csv, json and anything else: read as plain text
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return `[Could not read ${originalName}: ${err.message}]`;
  }
}

// Truncate per-document so a stack of uploads doesn't blow the context window.
function clip(text, maxChars = 12000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n...[truncated, ${text.length - maxChars} more characters]`;
}

async function loadDocuments(files) {
  const docs = [];
  for (const f of files || []) {
    const text = await extractText(f.path, f.originalname);
    docs.push({ filename: f.originalname, text: clip(text) });
  }
  return docs;
}

module.exports = { loadDocuments, clip };
