require('dotenv').config();
const path = require('path');
const express = require('express');
const multer = require('multer');
const { loadDocuments } = require('./documents');
const { startRun, getRun, approveIdeas, toPublic, listRuns } = require('./pipeline');
const { buildWorkbook } = require('./export');

const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

const app = express();
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/run', upload.array('documents'), async (req, res) => {
  try {
    const input = (req.body.brand || '').trim();
    if (!input) return res.status(400).json({ error: 'brand name, company name, or domain is required' });
    const domain = DOMAIN_RE.test(input) ? input.toLowerCase() : '';
    const brand = domain || input;

    const docs = await loadDocuments(req.files);
    const id = startRun({ brand, domain, docs });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/run/:id', (req, res) => {
  try {
    const run = getRun(req.params.id);
    res.json(toPublic(run));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.get('/api/runs', (req, res) => {
  res.json(listRuns());
});

app.get('/api/run/:id/export.xlsx', async (req, res) => {
  try {
    const run = getRun(req.params.id);
    const buf = await buildWorkbook(run);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${run.brand.replace(/[^a-z0-9]+/gi, '-')}-bioscriptz.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/run/:id/approve', (req, res) => {
  try {
    const approvedIdx = Array.isArray(req.body.approvedIdx) ? req.body.approvedIdx : [];
    const run = approveIdeas(req.params.id, approvedIdx);
    res.json(toPublic(run));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bioscriptz running on http://localhost:${PORT}`));
