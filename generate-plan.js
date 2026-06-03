const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageNumber, TabStopType,
  TabStopPosition, VerticalAlign, PageBreak
} = require('docx');
const fs = require('fs');

// ── Storage mode ──────────────────────────────────────────────────────────────
// STORAGE=local (default, spec-correct) | STORAGE=s3 (original "as-is" variant)
const USE_LOCAL = (process.env.STORAGE || 'local').toLowerCase() !== 's3';
const OUT = process.env.OUT || (USE_LOCAL
  ? 'DocuGuard-Development-Plan.docx'
  : 'DocuGuard-Development-Plan-AsIs-S3.docx');

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  navy:       '1B2A4A',
  accent:     '2563EB',
  lightBlue:  'DBEAFE',
  green:      '166534',
  greenBg:    'DCFCE7',
  red:        '991B1B',
  redBg:      'FEE2E2',
  amber:      '92400E',
  amberBg:    'FEF3C7',
  purple:     '4C1D95',
  purpleBg:   'EDE9FE',
  teal:       '134E4A',
  tealBg:     'CCFBF1',
  slate:      '1E293B',
  slateLight: 'F1F5F9',
  mid:        '64748B',
  white:      'FFFFFF',
  border:     'CBD5E1',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const border = (color = C.border) => ({
  top:    { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left:   { style: BorderStyle.SINGLE, size: 1, color },
  right:  { style: BorderStyle.SINGLE, size: 1, color },
});

const noBorder = () => ({
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
});

const cell = (text, opts = {}) => new TableCell({
  borders: opts.noBorder ? noBorder() : border(opts.borderColor || C.border),
  width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  margins: { top: 80, bottom: 80, left: 140, right: 140 },
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text: String(text),
      bold: opts.bold || false,
      color: opts.color || C.slate,
      size: opts.size || 20,
      font: 'Arial',
    })]
  })]
});

const hRow = (cols, fills, widths) => new TableRow({
  tableHeader: true,
  children: cols.map((c, i) => cell(c, {
    fill: fills[i] || C.navy,
    color: C.white,
    bold: true,
    width: widths ? widths[i] : undefined,
    borderColor: C.navy,
  }))
});

const space = (pt = 120) => new Paragraph({
  spacing: { before: pt, after: 0 },
  children: [new TextRun({ text: '', font: 'Arial' })]
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 360, after: 160 },
  children: [new TextRun({ text, font: 'Arial', size: 36, bold: true, color: C.navy })]
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 120 },
  children: [new TextRun({ text, font: 'Arial', size: 28, bold: true, color: C.accent })]
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  spacing: { before: 200, after: 80 },
  children: [new TextRun({ text, font: 'Arial', size: 24, bold: true, color: C.slate })]
});

const body = (text, opts = {}) => new Paragraph({
  spacing: { before: 60, after: 60 },
  alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
  children: [new TextRun({
    text,
    font: 'Arial',
    size: opts.size || 20,
    color: opts.color || C.slate,
    bold: opts.bold || false,
    italics: opts.italic || false,
  })]
});

const bullet = (text, opts = {}) => new Paragraph({
  numbering: { reference: 'bullets', level: opts.level || 0 },
  spacing: { before: 40, after: 40 },
  children: [new TextRun({
    text,
    font: 'Arial',
    size: 20,
    color: opts.color || C.slate,
    bold: opts.bold || false,
  })]
});

const divider = (color = C.accent) => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
  spacing: { before: 60, after: 60 },
  children: [new TextRun({ text: '', font: 'Arial' })]
});

// ── Phase badge row (coloured label) ─────────────────────────────────────────
const phaseBanner = (label, sub, fill) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
  rows: [new TableRow({ children: [
    new TableCell({
      borders: noBorder(),
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [
        new Paragraph({ children: [new TextRun({ text: label, font: 'Arial', size: 30, bold: true, color: C.white })] }),
        new Paragraph({ children: [new TextRun({ text: sub,   font: 'Arial', size: 20,             color: C.white })] }),
      ]
    })
  ]})]
});

// ── QA checklist table ────────────────────────────────────────────────────────
const qaTable = (rows) => {
  const header = hRow(['#', 'Test Case', 'Type', 'Expected Result', 'Pass Criteria'], [C.slate, C.slate, C.slate, C.slate, C.slate], [600, 2700, 1100, 3000, 1960]);
  const dataRows = rows.map((r, i) => new TableRow({ children: [
    cell(String(i + 1),  { width: 600,  fill: C.slateLight, center: true, bold: true }),
    cell(r[0],           { width: 2700 }),
    cell(r[1],           { width: 1100, fill: r[1] === 'Security' ? C.redBg : r[1] === 'Integration' ? C.lightBlue : r[1] === 'Performance' ? C.amberBg : C.slateLight, center: true }),
    cell(r[2],           { width: 3000 }),
    cell(r[3],           { width: 1960, fill: C.greenBg, color: C.green }),
  ]}));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [600, 2700, 1100, 3000, 1960], rows: [header, ...dataRows] });
};

// ── Deliverables table ────────────────────────────────────────────────────────
const delivTable = (rows) => {
  const header = hRow(['Deliverable', 'Description', 'Owner', 'Exit Criteria'], [C.navy, C.navy, C.navy, C.navy], [2200, 3700, 1260, 2200]);
  const dataRows = rows.map(r => new TableRow({ children: [
    cell(r[0], { width: 2200, bold: true }),
    cell(r[1], { width: 3700 }),
    cell(r[2], { width: 1260, center: true, fill: C.slateLight }),
    cell(r[3], { width: 2200, fill: C.greenBg, color: C.green }),
  ]}));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2200, 3700, 1260, 2200], rows: [header, ...dataRows] });
};

// ── Risk table ────────────────────────────────────────────────────────────────
const riskTable = (rows) => {
  const header = hRow(['Risk', 'Likelihood', 'Impact', 'Mitigation'], [C.red, C.red, C.red, C.red], [2800, 1400, 1400, 3760]);
  const likeColour = (l) => l === 'High' ? C.redBg : l === 'Medium' ? C.amberBg : C.greenBg;
  const likeText   = (l) => l === 'High' ? C.red   : l === 'Medium' ? C.amber   : C.green;
  const dataRows = rows.map(r => new TableRow({ children: [
    cell(r[0], { width: 2800 }),
    cell(r[1], { width: 1400, center: true, fill: likeColour(r[1]), color: likeText(r[1]), bold: true }),
    cell(r[2], { width: 1400, center: true, fill: likeColour(r[2]), color: likeText(r[2]), bold: true }),
    cell(r[3], { width: 3760 }),
  ]}));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2800, 1400, 1400, 3760], rows: [header, ...dataRows] });
};

// ── Sign-off table ─────────────────────────────────────────────────────────────
const signoffTable = (roles) => {
  const header = hRow(['Role', 'Name', 'Signature', 'Date'], [C.navy, C.navy, C.navy, C.navy], [2600, 2600, 2600, 1560]);
  const dataRows = roles.map(r => new TableRow({ children: [
    cell(r, { width: 2600, bold: true, fill: C.slateLight }),
    cell('', { width: 2600 }),
    cell('', { width: 2600 }),
    cell('', { width: 1560 }),
  ]}));
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2600, 2600, 2600, 1560], rows: [header, ...dataRows] });
};

// ── Storage-specific content (local filesystem vs S3) ──────────────────────────
const S = USE_LOCAL ? {
  summaryScope: 'Infrastructure, Docker, Auth, Local Storage, MongoDB schemas',
  storageHeading: 'Local Filesystem Storage',
  storageBullets: [
    'storage_service.py: save_file(file_bytes, relative_path), get_file_path(relative_path), delete_file(relative_path) — all rooted under LOCAL_STORAGE_DIR (./storage)',
    'Storage directory kept outside the public web root — the storage folder is never exposed via static file serving',
    'All file reads go through authenticated download endpoints (e.g. GET /api/reports/:id/download) — a raw filesystem path is never returned to the client',
    'Verify save and read round-trip with a test file; confirm path-traversal input (../) is rejected and resolved paths stay within LOCAL_STORAGE_DIR',
  ],
  storageDeliv: ['Storage Service', 'save_file, get_file_path, delete_file rooted under ./storage; verified round-trip', 'Backend Dev', 'Round-trip test passes; storage dir outside web root; path traversal blocked'],
  storageQa: [
    ['Local file save and authenticated download', 'Functional', 'File saved under ./storage; authenticated endpoint returns file content', 'HTTP 200 on /api/.../download with valid JWT; content matches upload'],
    ['Unauthenticated download blocked',           'Security',   'Download endpoint without a valid JWT returns 401',                       'Status 401; file bytes never served without auth'],
    ['Path traversal rejected',                    'Security',   'Request for ../../etc/passwd via storage path is rejected',               'Status 400/403; resolved path stays within LOCAL_STORAGE_DIR'],
  ],
  iamRisk: ['AWS IAM permissions misconfigured — Textract or Bedrock access denied', 'Medium', 'High', 'Run IAM policy simulator before starting; test Textract and Bedrock independently'],
  p2UploadBullets: [
    'Generate UUID-based local path: storage/documents/{uuid}/{original_filename}',
    'Save file to local storage via storage_service, save document metadata to MongoDB (status: pending), enqueue process_document Celery task',
  ],
  p2PdfBullet:   'PDF: Apache Tika first → if extracted text length < 100 chars, fall back to AWS Textract (local file bytes via detect_document_text)',
  p2ImgBullet:   'Images (PNG/JPG): pytesseract first → if text length < 50 chars, fall back to AWS Textract (local file bytes)',
  p2UploadDeliv: ['Upload API', 'POST /api/documents/upload with magic-bytes validation, local storage, Celery dispatch', 'Backend Dev', 'File saved under ./storage; metadata in MongoDB; Celery task enqueued within 2s'],
  p2StorageQa:   ['Authenticated download only — no direct file path access', 'Security', 'Storage path is not publicly served; only the authenticated endpoint returns file', '401 without JWT; 200 with valid JWT; storage dir is not web-accessible'],
  p4ReportBullets: [
    'Save generated report to local disk: storage/reports/{document_id}/audit_report_{timestamp}.{ext}',
    'Store audit_report_path in MongoDB; return an authenticated download URL (GET /api/reports/:id/download)',
  ],
} : {
  summaryScope: 'Infrastructure, Docker, Auth, S3, MongoDB schemas',
  storageHeading: 'AWS S3 Integration',
  storageBullets: [
    's3_service.py: upload_file(local_path, s3_key), download_file(s3_key, local_path), get_presigned_url(s3_key, expiry=900)',
    'S3 bucket configured as fully private — block all public access',
    'All file reads in the app go through pre-signed URLs only, never raw S3 paths',
    'Verify upload and download round-trip with a test file',
  ],
  storageDeliv: ['S3 Service', 'Upload, download, pre-signed URL generation verified', 'Backend Dev', 'Round-trip test passes; bucket is fully private'],
  storageQa: [
    ['S3 upload and pre-signed URL download',      'Functional', 'File uploaded; pre-signed URL returns file content', 'HTTP 200 on pre-signed URL, file content matches upload'],
    ['S3 pre-signed URL expires after 15 minutes', 'Security',   'URL returns 403 after 15-minute TTL',               'Status 403 on expired URL'],
  ],
  iamRisk: ['AWS IAM permissions misconfigured — S3 or Bedrock access denied', 'Medium', 'High', 'Run IAM policy simulator before starting; test each service independently'],
  p2UploadBullets: [
    'Generate UUID-based S3 key: documents/{uuid}/{original_filename}',
    'Upload to S3, save document metadata to MongoDB (status: pending), enqueue process_document Celery task',
  ],
  p2PdfBullet:   'PDF: Apache Tika first → if extracted text length < 100 chars, fall back to AWS Textract (S3Object reference, no local download)',
  p2ImgBullet:   'Images (PNG/JPG): pytesseract first → if text length < 50 chars, fall back to AWS Textract',
  p2UploadDeliv: ['Upload API', 'POST /api/documents/upload with magic-bytes validation, S3 storage, Celery dispatch', 'Backend Dev', 'File in S3, metadata in MongoDB, Celery task enqueued within 2s'],
  p2StorageQa:   ['Pre-signed URL access only — no public S3 URLs', 'Security', 'Direct S3 bucket URL returns 403; pre-signed URL works', '403 on bucket URL; 200 on presigned URL within 15 min'],
  p4ReportBullets: [
    'Upload generated report to S3: reports/{document_id}/audit_report_{timestamp}.{ext}',
    'Store audit_report_s3_key in MongoDB; return 15-minute pre-signed download URL',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720,  hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
    ]
  },
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: C.navy },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: C.accent },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: C.slate },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ]
  },

  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      }
    },

    headers: {
      default: new Header({ children: [
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [5040, 5040],
          rows: [new TableRow({ children: [
            new TableCell({ borders: noBorder(), children: [
              new Paragraph({ children: [new TextRun({ text: 'DocuGuard — Development Plan', font: 'Arial', size: 18, bold: true, color: C.navy })] })
            ]}),
            new TableCell({ borders: noBorder(), children: [
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [
                new TextRun({ text: 'v1.0  |  Confidential  |  Page ', font: 'Arial', size: 18, color: C.mid }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: C.mid }),
              ]})
            ]}),
          ]})]
        }),
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent, space: 1 } }, children: [] }),
      ]})
    },

    footers: {
      default: new Footer({ children: [
        new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.border, space: 1 } }, children: [] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: 'DocuGuard  |  Document Intelligence & Compliance Automation  |  Internal Use Only', font: 'Arial', size: 16, color: C.mid })
        ]})
      ]})
    },

    children: [

      // ══════════════════════════════════════════════════════════════════════
      //  COVER
      // ══════════════════════════════════════════════════════════════════════
      new Table({
        width: { size: 10080, type: WidthType.DXA },
        columnWidths: [10080],
        rows: [new TableRow({ children: [new TableCell({
          borders: noBorder(),
          shading: { fill: C.navy, type: ShadingType.CLEAR },
          margins: { top: 800, bottom: 800, left: 600, right: 600 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 }, children: [
              new TextRun({ text: 'DocuGuard', font: 'Arial', size: 64, bold: true, color: C.white })
            ]}),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 }, children: [
              new TextRun({ text: 'Document Intelligence & Compliance Automation', font: 'Arial', size: 28, color: 'BFDBFE' })
            ]}),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 0 }, children: [
              new TextRun({ text: 'DEVELOPMENT PLAN', font: 'Arial', size: 36, bold: true, color: C.white })
            ]}),
          ]
        })]})],
      }),

      space(200),

      // Meta info table
      new Table({
        width: { size: 10080, type: WidthType.DXA },
        columnWidths: [2000, 3040, 2000, 3040],
        rows: [
          new TableRow({ children: [
            cell('Document Version', { width: 2000, bold: true, fill: C.slateLight }),
            cell('1.0',              { width: 3040 }),
            cell('Date',             { width: 2000, bold: true, fill: C.slateLight }),
            cell('June 2026',        { width: 3040 }),
          ]}),
          new TableRow({ children: [
            cell('Project',          { width: 2000, bold: true, fill: C.slateLight }),
            cell('DocuGuard',        { width: 3040 }),
            cell('Status',           { width: 2000, bold: true, fill: C.slateLight }),
            cell('Draft — For Review', { width: 3040 }),
          ]}),
          new TableRow({ children: [
            cell('Tech Stack',       { width: 2000, bold: true, fill: C.slateLight }),
            cell(USE_LOCAL ? 'React + FastAPI + MongoDB + Local Storage + AWS Bedrock' : 'React + FastAPI + MongoDB + AWS S3 + AWS Bedrock', { width: 3040 }),
            cell('Total Phases',     { width: 2000, bold: true, fill: C.slateLight }),
            cell('5 Phases',         { width: 3040 }),
          ]}),
        ]
      }),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  1. EXECUTIVE SUMMARY
      // ══════════════════════════════════════════════════════════════════════
      h1('1. Executive Summary'),
      divider(),
      body('DocuGuard is a full-stack AI-powered document intelligence and compliance automation platform built for regulated industries including finance, healthcare, and legal. The system ingests documents in PDF, DOCX, and image formats, extracts structured data through OCR and NLP pipelines, validates content against major compliance frameworks (HIPAA, GDPR, SOC 2, PCI-DSS), and generates AI-powered audit reports — all through a secure, role-based web dashboard.'),
      space(80),
      body('This Development Plan organises the build into five sequential phases, each with a defined scope, concrete deliverables, and an extensive QA gate before the next phase begins. No phase may commence until all QA test cases for the preceding phase pass. The goal is a maintainable, production-ready system with zero critical defects at launch.'),
      space(80),

      h2('1.1 Phase Summary'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [600, 1800, 3400, 1480, 2080],
        rows: [
          hRow(['#', 'Phase', 'Scope', 'Duration', 'Key Gate'], [C.navy, C.navy, C.navy, C.navy, C.navy], [600, 1800, 3400, 1480, 2080]),
          new TableRow({ children: [
            cell('1', { width: 600,  fill: C.lightBlue, center: true, bold: true, color: C.accent }),
            cell('Foundation',   { width: 1800, bold: true }),
            cell(S.summaryScope, { width: 3400 }),
            cell('Week 1–2',     { width: 1480, center: true }),
            cell('All services reachable, auth working', { width: 2080, fill: C.greenBg, color: C.green }),
          ]}),
          new TableRow({ children: [
            cell('2', { width: 600, fill: C.purpleBg, center: true, bold: true, color: C.purple }),
            cell('Processing Pipeline', { width: 1800, bold: true }),
            cell('OCR, text extraction, document classification', { width: 3400 }),
            cell('Week 3–4', { width: 1480, center: true }),
            cell('Text extracted & classified for all file types', { width: 2080, fill: C.greenBg, color: C.green }),
          ]}),
          new TableRow({ children: [
            cell('3', { width: 600, fill: C.amberBg, center: true, bold: true, color: C.amber }),
            cell('Compliance Engine', { width: 1800, bold: true }),
            cell('Rule engine, all 4 checklists, Bedrock AI integration', { width: 3400 }),
            cell('Week 5–6', { width: 1480, center: true }),
            cell('Violations detected, risk scored, AI suggestions generated', { width: 2080, fill: C.greenBg, color: C.green }),
          ]}),
          new TableRow({ children: [
            cell('4', { width: 600, fill: C.tealBg, center: true, bold: true, color: C.teal }),
            cell('Dashboard & Reports', { width: 1800, bold: true }),
            cell('Full React UI, PDF viewer, audit report generation', { width: 3400 }),
            cell('Week 7–8', { width: 1480, center: true }),
            cell('End-to-end upload-to-report workflow functional', { width: 2080, fill: C.greenBg, color: C.green }),
          ]}),
          new TableRow({ children: [
            cell('5', { width: 600, fill: C.redBg, center: true, bold: true, color: C.red }),
            cell('Security & Hardening', { width: 1800, bold: true }),
            cell('RBAC, encryption, rate limiting, penetration readiness', { width: 3400 }),
            cell('Week 9–10', { width: 1480, center: true }),
            cell('All security tests pass, zero critical vulns', { width: 2080, fill: C.greenBg, color: C.green }),
          ]}),
        ]
      }),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  PHASE 1
      // ══════════════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      phaseBanner('Phase 1 — Foundation', 'Infrastructure · Docker · Authentication · Storage · Database  |  Week 1–2', C.accent),
      space(120),

      h2('1.1 Objectives'),
      body('Phase 1 establishes the entire technical foundation on which all subsequent phases depend. Nothing can be built reliably until infrastructure is stable, developers can run the stack locally in one command, and authentication is end-to-end verified.'),
      space(80),

      h2('1.2 Scope & Tasks'),
      h3('Infrastructure & Docker'),
      bullet('Scaffold full project directory structure: frontend/, backend/, docker-compose.yml, Dockerfiles'),
      bullet('Docker Compose services: api (FastAPI, port 8000), worker (Celery), redis (port 6379), frontend (Vite, port 5173)'),
      bullet('Backend Dockerfile: Python 3.11-slim, install tesseract-ocr, default-jdk, libmagic1'),
      bullet('Verify: docker-compose up --build starts all four services with zero errors'),
      bullet('FastAPI /docs Swagger UI reachable at http://localhost:8000/docs'),

      h3('Custom JWT Authentication'),
      bullet('MongoDB users collection with schema: email, hashed_password, full_name, role, is_active, created_at, last_login'),
      bullet('auth_utils.py: hash_password (bcrypt cost 12), verify_password, create_access_token (1hr), create_refresh_token (7d) with JTI, decode_token'),
      bullet('POST /api/auth/register — validate email uniqueness, hash password, save user (default role: reviewer)'),
      bullet('POST /api/auth/login — verify password, return access + refresh tokens; set refresh in httpOnly cookie'),
      bullet('POST /api/auth/refresh — verify refresh token, check Redis blacklist, issue new access token'),
      bullet('POST /api/auth/logout — add refresh token JTI to Redis blacklist with 7-day TTL'),
      bullet('GET /api/auth/me — return current user profile, no password hash'),
      bullet('FastAPI OAuth2PasswordBearer dependency: decode JWT, extract user_id and role'),
      bullet('Frontend AuthContext: login(), logout(), refreshSession() on page load, access token in memory, refresh token in httpOnly cookie'),
      bullet('Axios interceptor: on 401, auto-call /api/auth/refresh, retry original request; on refresh failure, redirect to /login'),
      bullet('Protected routes in React Router: redirect unauthenticated users to /login'),

      h3(S.storageHeading),
      ...S.storageBullets.map(b => bullet(b)),

      h3('MongoDB Schemas'),
      bullet('Define all five collections with indexes: users (email unique), documents (uploader_id, status, checklist_id), checklists, audit_logs (timestamp, user_id), notifications (user_id, read)'),
      bullet('Motor async client wired into FastAPI lifespan events (connect on startup, close on shutdown)'),
      bullet('Redis client initialised in database.py for Celery broker and JWT blacklist'),

      h3('Celery Setup'),
      bullet('celery_app.py configured with Redis broker and result backend'),
      bullet('Placeholder task ping.delay() verifiable via Celery worker logs'),
      bullet('Task chaining structure defined (document_tasks.py): extract → classify → validate → summarise → notify'),

      space(120),
      h2('1.3 Deliverables'),
      delivTable([
        ['Running Docker Stack',    'All four containers start cleanly with docker-compose up --build',             'Backend Dev', 'Zero container errors; all ports reachable'],
        ['Auth API (5 endpoints)',  'Register, Login, Refresh, Logout, Me endpoints fully functional',              'Backend Dev', 'All auth flows return correct status codes and tokens'],
        ['Frontend Auth Flow',      'Login, Register pages; protected routes; Axios interceptor with auto-refresh', 'Frontend Dev', 'Session persists on page refresh; logout clears all tokens'],
        S.storageDeliv,
        ['MongoDB + Redis',         'All collections created with indexes; Motor and Redis clients connected',       'Backend Dev', 'Connection health check endpoint returns OK'],
        ['Celery Worker',           'Worker starts, broker connected, ping task executes',                          'Backend Dev', 'Celery task appears in worker logs within 2s of dispatch'],
      ]),

      space(120),
      h2('1.4 Phase 1 QA Gate'),
      body('All tests below must achieve PASS status before Phase 2 begins. Any FAIL blocks the phase transition.', { bold: false }),
      space(80),

      h3('Functional Tests'),
      qaTable([
        ['POST /api/auth/register with valid data',          'Functional',    '201 Created, user saved in MongoDB with bcrypt hash',              'Status 200/201, hashed_password starts with $2b$12$'],
        ['POST /api/auth/register with duplicate email',     'Functional',    '409 Conflict returned',                                            'Status 409, no duplicate user created'],
        ['POST /api/auth/login with correct credentials',    'Functional',    'Returns access_token JSON and sets httpOnly refresh cookie',        'access_token present in body; Set-Cookie header present'],
        ['POST /api/auth/login with wrong password',         'Functional',    '401 Unauthorized returned',                                        'Status 401, no tokens issued'],
        ['GET /api/auth/me with valid access token',         'Functional',    'Returns user profile without hashed_password field',               'Status 200, hashed_password absent from response'],
        ['GET /api/auth/me with expired token',              'Functional',    '401 Unauthorized',                                                 'Status 401'],
        ['POST /api/auth/refresh with valid cookie',         'Functional',    'New access_token returned',                                        'Status 200, new token differs from old token'],
        ['POST /api/auth/logout then POST /api/auth/refresh','Functional',    '401 — token is blacklisted in Redis',                              'Status 401, JTI found in Redis blacklist'],
        ['React: page refresh restores session',             'Functional',    'AuthContext calls /api/auth/refresh on mount, user stays logged in', 'Dashboard accessible after F5 without re-login'],
        ['React: protected route redirects unauthenticated', 'Functional',    '/dashboard redirects to /login if no session',                     'Browser redirected to /login'],
        ['React: 401 triggers auto-refresh and retry',       'Functional',    'Axios interceptor refreshes token transparently',                   'API call succeeds after auto-refresh, user sees no error'],
        ...S.storageQa,
        ['MongoDB Motor connection health check',            'Functional',    'GET /api/health returns MongoDB and Redis status',                  'Both show connected: true'],
        ['Celery ping task dispatched and executed',         'Functional',    'Task appears in worker logs within 2 seconds',                     'Worker log shows task SUCCESS'],
        ['Docker compose restarts cleanly',                  'Functional',    'docker-compose down then up brings all services back',              'All four containers running after restart'],
      ]),

      space(120),
      h2('1.5 Phase 1 Risk Register'),
      riskTable([
        S.iamRisk,
        ['Bedrock model not enabled in AWS Console',                          'High',   'High',   'Enable anthropic.claude-3-5-sonnet-20241022-v2:0 in Model Access on Day 1'],
        ['bcrypt hashing too slow on low-spec dev machine',                  'Low',    'Low',    'Cost factor 12 gives ~250ms per hash; acceptable for auth endpoints'],
        ['Redis not persisting JWT blacklist across restarts',               'Medium', 'Medium', 'Use Redis AOF persistence or accept re-login requirement on Redis restart'],
      ]),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  PHASE 2
      // ══════════════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      phaseBanner('Phase 2 — Document Processing Pipeline', 'Upload · OCR · Text Extraction · Classification  |  Week 3–4', C.purple),
      space(120),

      h2('2.1 Objectives'),
      body('Phase 2 builds the core ingestion pipeline. A user uploads a document; the system stores it securely, extracts all readable text (regardless of format or whether it is a scanned image), classifies what type of document it is, and updates status in real time. By the end of this phase, every uploaded file has structured extracted text and a document type label stored in MongoDB.'),
      space(80),

      h2('2.2 Scope & Tasks'),
      h3('Document Upload Endpoint'),
      bullet('POST /api/documents/upload — receive multipart file(s), validate type via python-magic (magic bytes, not extension)'),
      bullet('Accepted types: PDF, DOCX, PNG, JPG, JPEG — reject all others with 415 Unsupported Media Type'),
      bullet('Max file size: 50MB per file; max batch: 10 files per request'),
      ...S.p2UploadBullets.map(b => bullet(b)),
      bullet('Return document ID immediately — do not wait for processing'),

      h3('File Upload UI'),
      bullet('FileUploader.jsx using React Dropzone — drag-and-drop + click to browse'),
      bullet('Client-side validation: file type (MIME), size limit, max 10 files'),
      bullet('Per-file upload progress bar using Axios onUploadProgress'),
      bullet('ChecklistSelector dropdown: HIPAA / GDPR / SOC 2 / PCI-DSS / Custom'),
      bullet('On all uploads complete: redirect to /documents/:id for the first uploaded document'),
      bullet('useDocumentStatus hook: polls GET /api/documents/:id/status every 5 seconds while status is not completed or failed'),

      h3('OCR & Text Extraction Service'),
      bullet(S.p2PdfBullet),
      bullet('DOCX: python-docx primary extraction, Tika as backup'),
      bullet(S.p2ImgBullet),
      bullet('Store extracted_text encrypted with AES-256 Fernet in MongoDB'),
      bullet('Update status to extracting at task start, then classifying after success'),

      h3('Document Classification Service'),
      bullet('Rule-based keyword scoring across 9 document types: Medical Record, Consent Form, Legal Contract, Invoice, Privacy Policy, Audit Report, Employment Agreement, Insurance Policy, Procurement Document'),
      bullet('Confidence score = matched_keywords / total_keywords for the best-matching type'),
      bullet('If confidence < 0.75: fall back to AWS Bedrock (Claude 3.5 Sonnet) via bedrock_service.classify_document_with_ai()'),
      bullet('Store classification, confidence_score in MongoDB; update status to validating'),

      h3('Status Polling Endpoint'),
      bullet('GET /api/documents/:id/status — returns { status, classification, confidence_score, progress_percent }'),
      bullet('Frontend shows animated progress indicator while status is extracting or classifying'),

      space(120),
      h2('2.3 Deliverables'),
      delivTable([
        S.p2UploadDeliv,
        ['File Upload UI',          'Drag-and-drop uploader with per-file progress, checklist selector, redirect on complete', 'Frontend Dev', 'Files upload with visual progress; checklist selection saved to document'],
        ['OCR Service',             'Tesseract → Textract fallback for images; Tika → Textract fallback for PDFs', 'Backend Dev', 'Extracted text > 50 chars for all sample file types'],
        ['Classification Service',  'Rule-based + Bedrock fallback, stores type and confidence', 'Backend Dev', 'Correct type for 9/10 sample documents; confidence score present'],
        ['Celery Pipeline (Steps 1–2)', 'extract_text and classify_document tasks chained and running', 'Backend Dev', 'Status transitions: pending → extracting → classifying → validating'],
        ['Status Polling UI',       'useDocumentStatus hook updates progress bar every 5s', 'Frontend Dev', 'Dashboard shows live status change without page refresh'],
      ]),

      space(120),
      h2('2.4 Phase 2 QA Gate'),
      space(80),

      h3('Functional & Integration Tests'),
      qaTable([
        ['Upload valid PDF via UI',                       'Functional',    'File stored, document record in MongoDB, Celery task enqueued',                'Storage location populated; MongoDB status = pending then extracting'],
        ['Upload DOCX file',                              'Functional',    'Text extracted via python-docx; status reaches classifying',                   'extracted_text non-empty; status = classifying'],
        ['Upload scanned PNG (no text layer)',            'Functional',    'Tesseract returns < 50 chars; Textract fallback runs; text extracted',          'Textract called (visible in logs); extracted_text non-empty'],
        ['Upload valid PDF with native text layer',       'Functional',    'Tika extracts text; Textract NOT called (text >= 100 chars)',                   'Textract not in logs; extracted_text from Tika'],
        ['Upload file with forbidden type (.exe)',        'Security',      '415 Unsupported Media Type returned; file not stored',                          'Status 415; no file stored; no MongoDB record'],
        ['Upload file with spoofed extension (PNG renamed .pdf)', 'Security', '415 rejected by magic-bytes check',                                         'Status 415 — extension alone does not bypass validation'],
        ['Upload file > 50MB',                            'Functional',    '413 Request Entity Too Large',                                                  'Status 413; file not stored'],
        ['Upload batch of 10 files',                      'Functional',    'All 10 uploaded, 10 Celery tasks enqueued',                                    '10 MongoDB documents created; 10 tasks in worker logs'],
        ['Rule-based classification: Legal Contract',     'Functional',    'Document containing "whereas", "indemnify", "governing law" classified correctly', 'classification = Legal Contract, confidence >= 0.75'],
        ['Rule-based classification: Invoice',            'Functional',    'Document with "invoice number", "amount due" classified correctly',             'classification = Invoice'],
        ['Low-confidence doc falls back to Bedrock',      'Integration',   'Bedrock classify_document_with_ai called; result stored',                      'Bedrock API call in logs; classification stored'],
        ['Bedrock unavailable — classification fallback', 'Integration',   'If Bedrock raises exception, classification = Unknown, confidence = 0.0',       'No crash; status still reaches validating'],
        ['Status polling returns live status',            'Functional',    'GET /api/documents/:id/status returns current status and progress',             'Response updates from extracting to classifying within 30s'],
        ['Frontend progress bar updates without refresh', 'Functional',    'useDocumentStatus hook reflects status changes live',                           'Progress bar animates; status label changes automatically'],
        ['extracted_text stored encrypted in MongoDB',    'Security',      'MongoDB extracted_text field is Fernet-encrypted ciphertext',                   'Value starts with gAAA (Fernet prefix), not plaintext'],
        S.p2StorageQa,
      ]),

      space(120),
      h2('2.5 Phase 2 Risk Register'),
      riskTable([
        ['Tika requires Java — missing from Docker image',     'Medium', 'High',   'Verify default-jdk is installed in Dockerfile; test Tika in container before coding'],
        ['Textract billing spikes on large batches',           'Medium', 'Medium', 'Implement per-user daily Textract call limit; monitor AWS Cost Explorer'],
        ['OCR quality too low for handwritten documents',      'High',   'Medium', 'Scope: typed documents only; add disclaimer in UI for handwritten content'],
        ['Celery task queue backs up under load',              'Low',    'Medium', 'Set concurrency=4 in worker; add task ETA monitoring to /health endpoint'],
      ]),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  PHASE 3
      // ══════════════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      phaseBanner('Phase 3 — Compliance Engine & AI Integration', 'Rule Engine · Checklists · Bedrock Summarisation · Violations  |  Week 5–6', C.amber),
      space(120),

      h2('3.1 Objectives'),
      body('Phase 3 is the intelligence layer of DocuGuard. The compliance engine evaluates extracted text against all four built-in rule sets (HIPAA, GDPR, SOC 2, PCI-DSS), detects violations with character-level precision, calls AWS Bedrock (Claude 3.5 Sonnet) for specific fix suggestions and document summaries, and calculates a 0–100 risk score. By the end of this phase, every processed document has a full violation list, AI-generated fix suggestions, a plain-language summary, and a risk rating.'),
      space(80),

      h2('3.2 Scope & Tasks'),
      h3('Compliance JSON Checklists'),
      bullet('hipaa.json — 12 rules: SSN pattern, DOB pattern, consent keywords, PHI encryption, minimum necessary, data sharing auth, breach notification, BAA reference, access control, audit controls, transmission security, de-identification'),
      bullet('gdpr.json — 12 rules: lawful basis, data subject rights, right to erasure, retention period, DPO contact, cross-border transfers, consent withdrawal, cookie policy, 72-hour breach notification, privacy by design, data minimization, processor agreements'),
      bullet('soc2.json — 10 rules: security policy, change management, incident response, vendor management, logical access, availability commitments, confidentiality, processing integrity, monitoring and logging, vulnerability management'),
      bullet('pci_dss.json — 10 rules: PAN regex, CVV forbidden, cardholder data protection, encryption standard, network segmentation, access restriction, security testing, incident response, firewall configuration, anti-malware policy'),
      bullet('internal_audit.json — 8 baseline rules usable as a starter custom checklist'),
      bullet('Detection types implemented: pattern (regex), keyword_required (absence = violation), keyword_forbidden (presence = violation), nlp_entity (spaCy NER)'),

      h3('Compliance Engine'),
      bullet('compliance_engine.py: load checklist from JSON or MongoDB, iterate rules, run detection on decrypted extracted_text'),
      bullet('Each violation records: rule_id, category, severity, description, matched_text, offset_start, offset_end, generic_fix'),
      bullet('Risk score: critical=40pts, warning=20pts, info=5pts — capped at 100'),
      bullet('risk_level mapping: 0–30 = Low, 31–60 = Medium, 61–100 = High'),

      h3('AWS Bedrock AI Integration'),
      bullet('bedrock_service.py: single call_bedrock() function wrapping boto3 invoke_model for anthropic.claude-3-5-sonnet-20241022-v2:0'),
      bullet('summarize_document(extracted_text) — returns JSON: summary, key_clauses, risk_level, document_purpose'),
      bullet('get_ai_fix_suggestion(rule_description, matched_text, context) — returns specific 2–3 sentence actionable fix'),
      bullet('classify_document_with_ai(extracted_text) — fallback classifier (already wired in Phase 2)'),
      bullet('All three functions wrapped in try/except — graceful fallback if Bedrock is unavailable'),
      bullet('AI fix suggestions generated per violation and merged into the violations array as ai_fix_suggestion field'),

      h3('Celery Pipeline — Steps 3 & 4'),
      bullet('run_compliance task: decrypt extracted_text, load checklist, run engine, call Bedrock for each violation fix, store violations + risk_score + risk_level, update status to validating'),
      bullet('generate_summary task: call bedrock_service.summarize_document(), store summary + key_clauses + document_purpose, update status to completed'),
      bullet('notify_reviewers task: create notification records in MongoDB for all users with role reviewer or admin'),

      h3('Custom Checklist API'),
      bullet('GET /api/compliance/checklists — list all built-in and custom checklists'),
      bullet('POST /api/compliance/checklists — create custom checklist (Admin/Reviewer only)'),
      bullet('PUT/DELETE /api/compliance/checklists/:id — update or remove custom checklists'),
      bullet('POST /api/compliance/validate/:id — re-trigger compliance check on an existing document (e.g., after checklist update)'),

      space(120),
      h2('3.3 Deliverables'),
      delivTable([
        ['4 Compliance Checklists',   'hipaa.json, gdpr.json, soc2.json, pci_dss.json with 10–12 rules each',              'Backend Dev', 'All rules load without errors; each file passes JSON schema validation'],
        ['Compliance Engine',         'pattern, keyword_required, keyword_forbidden, nlp_entity detection with risk scoring', 'Backend Dev', 'Violations detected with correct offsets; risk_score 0–100'],
        ['Bedrock AI Service',        'summarize_document, get_ai_fix_suggestion, classify_document_with_ai',               'Backend Dev', 'All three functions return valid structured output; fallback on failure'],
        ['Violations Stored',         'Full violation array with ai_fix_suggestion per rule stored in MongoDB document',      'Backend Dev', 'violations array present; each entry has all required fields'],
        ['Celery Steps 3–4',          'run_compliance and generate_summary tasks complete the pipeline',                     'Backend Dev', 'Status reaches completed; summary and violations in MongoDB'],
        ['Checklist CRUD API',        'GET, POST, PUT, DELETE endpoints for custom checklists',                              'Backend Dev', 'Custom checklist saved, retrieved, and used in validation'],
      ]),

      space(120),
      h2('3.4 Phase 3 QA Gate'),
      space(80),

      h3('Compliance Engine Tests'),
      qaTable([
        ['HIPAA SSN pattern detection',              'Functional',    'Document with "123-45-6789" triggers HIPAA-001 critical violation',              'violations contains rule_id HIPAA-001; matched_text = 123-45-6789'],
        ['HIPAA consent keyword required',           'Functional',    'Document missing "consent" triggers HIPAA keyword_required violation',           'Violation with description referencing patient consent'],
        ['GDPR right to erasure keyword required',   'Functional',    'Document without "right to erasure" triggers GDPR violation',                   'GDPR violation with correct rule_id present'],
        ['PCI-DSS credit card PAN pattern',          'Functional',    '16-digit card number detected as critical violation',                            'PCI-DSS PAN rule triggered; severity = critical'],
        ['PCI-DSS CVV forbidden keyword',            'Functional',    'Document containing "cvv stored" triggers forbidden keyword violation',           'PCI-DSS CVV rule triggered'],
        ['spaCy NER entity detection',               'Functional',    'PERSON entity triggers nlp_entity rule where configured',                        'violation recorded with entity type in matched_text'],
        ['Risk score: no violations',                'Functional',    'Clean document scores 0; risk_level = Low',                                      'risk_score = 0; risk_level = Low'],
        ['Risk score: 2 critical violations',        'Functional',    'Score = 80 (capped at 100 if more); risk_level = High',                          'risk_score >= 60; risk_level = High'],
        ['Risk score capped at 100',                 'Functional',    'Many violations do not exceed 100',                                              'risk_score <= 100'],
        ['Bedrock summarization call',               'Integration',   'summary, key_clauses, risk_level, document_purpose returned and stored',         'All four fields non-empty in MongoDB'],
        ['Bedrock AI fix suggestion per violation',  'Integration',   'ai_fix_suggestion field present in every violation',                             'Each violation.ai_fix_suggestion is non-empty string'],
        ['Bedrock unavailable — graceful fallback',  'Integration',   'Engine falls back to generic_fix; status still reaches completed',               'No crash; generic_fix used; status = completed'],
        ['Re-trigger validation via API',            'Functional',    'POST /api/compliance/validate/:id re-runs engine with updated checklist',         'New violations stored; old violations replaced'],
        ['Custom checklist created and used',        'Functional',    'POST /api/compliance/checklists creates checklist; upload uses it',               'Custom violations detected based on custom rules'],
        ['Character offsets are precise',            'Functional',    'offset_start and offset_end point to exact matched_text in extracted_text',       'extracted_text[offset_start:offset_end] == matched_text'],
        ['All 4 checklists load without error',      'Functional',    'JSON parsing of all checklist files succeeds on startup',                         'No JSON parse errors in startup logs'],
      ]),

      space(120),
      h2('3.5 Phase 3 Risk Register'),
      riskTable([
        ['Bedrock rate limits exceeded on concurrent validation tasks', 'Medium', 'High',   'Implement exponential back-off in call_bedrock(); limit to 3 concurrent Bedrock calls'],
        ['Regex pattern false positives (e.g., phone numbers as SSN)', 'High',   'Medium', 'Tune patterns with word-boundary anchors; add QA test for false-positive cases'],
        ['spaCy model not downloaded in container',                     'Low',    'High',   'Run python -m spacy download en_core_web_sm in Dockerfile at build time'],
        ['AI fix suggestions are too generic',                          'Medium', 'Medium', 'Include 200 chars of surrounding context in Bedrock prompt; refine prompt in QA'],
      ]),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  PHASE 4
      // ══════════════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      phaseBanner('Phase 4 — Dashboard, Review Workflow & Audit Reports', 'React UI · PDF Viewer · Annotations · Reports · Notifications  |  Week 7–8', C.teal),
      space(120),

      h2('4.1 Objectives'),
      body('Phase 4 makes the system usable by real people. It delivers the complete React dashboard with every page and component, an interactive PDF viewer with violation highlights overlaid on the text layer, the approval/rejection workflow, downloadable audit reports in PDF and DOCX format, role-based access control enforcement on both frontend and backend, and in-app notifications with a full audit trail.'),
      space(80),

      h2('4.2 Scope & Tasks'),
      h3('Dashboard Page'),
      bullet('Stat cards: Total Documents, Pending Review, Critical Violations, Approved Today'),
      bullet('Documents table: filename, type badge, checklist, risk badge (colour-coded), status badge, uploader, date, action buttons'),
      bullet('Filter bar: All / Pending / Approved / Rejected / High Risk — client-side filter with URL query param sync'),
      bullet('Paginated API: GET /api/documents?page=1&limit=20&status=pending&risk=high'),

      h3('Document Review Page'),
      bullet('Left panel: @react-pdf-viewer/core renders PDF with pdfjs-dist text layer'),
      bullet('Violation highlight overlays positioned using character offsets converted to pdfjs text layer coordinates'),
      bullet('Right panel with three tabs — Overview, Violations, Actions'),
      bullet('Overview tab: classification badge, confidence percentage bar, risk score meter (0–100 dial), AI summary paragraph, key clauses list, document purpose'),
      bullet('Violations tab: grouped by severity (critical first). Each card: severity badge (red/amber/blue), rule ID, description, matched text snippet (highlighted), generic fix, AI-specific fix'),
      bullet('Actions tab: Approve button, Reject button with required reason textarea, comment input field, Download Report selector (PDF/DOCX) with download button'),
      bullet('Status banner at top: Processing / Completed / Approved / Rejected with corresponding colour'),

      h3('Audit Report Generation'),
      bullet('POST /api/reports/generate/:id?format=pdf|docx'),
      bullet('PDF via ReportLab: styled header, 8 sections, coloured severity badges, risk score bar, auditor signature line'),
      bullet('DOCX via python-docx: matching structure and content'),
      ...S.p4ReportBullets.map(b => bullet(b)),
      bullet('Frontend "Download Report" button triggers generation, polls for completion, auto-downloads file'),

      h3('Audit Logs Page'),
      bullet('GET /api/audit-logs?page=1&limit=50&user_id=x&action=approve&from=date&to=date'),
      bullet('Table: timestamp, user email, action badge, document name, metadata summary'),
      bullet('Date range picker + action type filter + user search'),
      bullet('GET /api/audit-logs/export — returns CSV download of filtered logs'),
      bullet('Log written to audit_logs collection on every: login, logout, upload, extract, classify, validate, approve, reject, download_report, create_checklist'),

      h3('Checklist Builder Page'),
      bullet('List existing checklists (built-in + custom) with rule count badges'),
      bullet('Form to add rule: name, category, severity dropdown, detection type radio (pattern/keyword_required/keyword_forbidden/nlp_entity), input for pattern or keywords, fix suggestion textarea'),
      bullet('Save as new custom checklist or add rule to existing custom checklist'),
      bullet('Delete custom checklist (Admin only)'),

      h3('Admin Users Page'),
      bullet('GET /api/users — table: name, email, role badge, is_active toggle, last_login'),
      bullet('PATCH /api/users/:id/role — change role via dropdown (Admin only)'),
      bullet('PATCH /api/users/:id/deactivate — deactivate/reactivate account'),

      h3('Notifications'),
      bullet('Bell icon in Navbar with unread count badge'),
      bullet('useNotifications hook polls GET /api/notifications every 30 seconds'),
      bullet('Dropdown panel shows latest 10 notifications with type icons'),
      bullet('PATCH /api/notifications/:id/read and PATCH /api/notifications/read-all'),
      bullet('Notify all reviewers and admins when a document reaches completed status'),
      bullet('Notify uploader when their document is approved or rejected'),

      h3('Settings Page'),
      bullet('Profile: full name editable, email read-only, role badge'),
      bullet('Change password form: current password + new password + confirm (validated client-side and server-side)'),
      bullet('Notification preferences: toggle email and in-app notifications for approvals, rejections, and new uploads'),

      space(120),
      h2('4.3 Deliverables'),
      delivTable([
        ['Dashboard Page',          'Stat cards, filterable/paginated documents table with live status', 'Frontend Dev', 'All stat cards accurate; filters and pagination work against live API'],
        ['Document Review Page',    'PDF viewer with violation highlights; Overview / Violations / Actions tabs', 'Frontend Dev', 'Highlights align to offsets; all three tabs render live data'],
        ['Audit Report Generation', 'PDF (ReportLab) + DOCX (python-docx), 8 sections, saved to storage', 'Backend Dev', 'Both formats generate; downloadable via authenticated URL'],
        ['Audit Logs Page',         'Filterable log table + CSV export', 'Full Stack', 'Every key action logged; CSV export matches active filters'],
        ['Checklist Builder',       'Create/edit custom checklists with all 4 detection types', 'Frontend Dev', 'Custom checklist saved and usable on upload'],
        ['Admin Users Page',        'User table, role change, activate/deactivate (Admin only)', 'Full Stack', 'Role changes persist; non-admins cannot access'],
        ['Notifications',           'Bell icon, unread badge, 30s polling, mark-as-read', 'Frontend Dev', 'Reviewers notified on completion; uploader on approve/reject'],
      ]),

      space(120),
      h2('4.4 Phase 4 QA Gate'),
      space(80),

      h3('Functional, Integration & Security Tests'),
      qaTable([
        ['Dashboard stat cards reflect real counts',     'Functional',  'Total / Pending / Critical / Approved Today computed from DB',           'Counts match MongoDB aggregate queries'],
        ['Documents table filter: High Risk',            'Functional',  'Filter shows only risk_level High documents',                            'Only High-risk docs listed; URL query param synced'],
        ['Pagination returns correct page',              'Functional',  'GET /api/documents?page=2&limit=20 returns the next slice',               'Correct page slice; total count present in response'],
        ['PDF viewer renders document',                  'Functional',  '@react-pdf-viewer renders the PDF with text layer',                       'Document visible; pdfjs text layer present'],
        ['Violation highlights align to offsets',        'Functional',  'Overlays map offset_start/offset_end to text-layer coordinates',          'Highlight covers the exact matched_text in the viewer'],
        ['Overview tab shows full analysis',             'Functional',  'Classification, confidence, risk meter, summary, key clauses rendered',   'All fields populated from the document record'],
        ['Violations grouped by severity',               'Functional',  'Critical → warning → info ordering with counts',                          'Critical cards appear first; severity counts correct'],
        ['Approve document',                             'Functional',  'PATCH /api/documents/:id/approve sets approval_status approved',           'approval_status = approved; approved_by + approved_at set; audit log written'],
        ['Reject requires a reason',                     'Functional',  'Reject without reason rejected; with reason succeeds',                     '422 without reason; 200 with reason stored in rejection_reason'],
        ['Generate PDF report',                          'Integration', 'POST /api/reports/generate/:id?format=pdf produces a file',               '8 sections present; saved to reports storage; audit_report_path set'],
        ['Generate DOCX report',                         'Integration', 'format=docx produces a matching DOCX',                                    'DOCX downloadable; content matches the PDF report'],
        ['Report download is authenticated',             'Security',    'GET /api/reports/:id/download requires a valid JWT',                       '401 without token; 200 with valid token'],
        ['Audit log written on every action',            'Functional',  'login / upload / approve / reject / download_report logged',              'audit_logs entry created with user, action, timestamp'],
        ['CSV export matches active filter',             'Functional',  'GET /api/audit-logs/export honours the active filters',                   'CSV rows equal the filtered table rows'],
        ['Notification on document completion',          'Integration', 'Reviewers and admins notified when status = completed',                   'notification records created for all reviewers/admins'],
        ['Notification on approve/reject',               'Integration', 'Uploader notified on approval or rejection',                              'Uploader receives notification; unread badge increments'],
        ['Custom checklist used in validation',          'Functional',  'A checklist built in the UI is applied on upload',                        'Custom rules produce violations on a matching document'],
        ['Admin-only pages blocked for reviewer',        'Security',    'Reviewer cannot open /admin/users',                                       'Frontend redirect/403; API returns 403'],
      ]),

      space(120),
      h2('4.5 Phase 4 Risk Register'),
      riskTable([
        ['PDF text-layer coordinates drift from character offsets', 'High',   'Medium', 'Build an offset→coordinate mapping utility; QA highlight alignment on 5 sample PDFs'],
        ['ReportLab and python-docx output diverge between formats', 'Medium', 'Low',    'Drive both generators from one shared report-data structure'],
        ['Large documents slow the PDF viewer',                     'Medium', 'Medium', 'Lazy-load pages via pdfjs; virtualise the violation list'],
        ['Polling load (status 5s + notifications 30s) strains API', 'Low',    'Medium', 'Stop status polling once completed/failed; cache notification counts'],
      ]),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  PHASE 5
      // ══════════════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      phaseBanner('Phase 5 — Security & Hardening', 'RBAC · Encryption · Rate Limiting · Headers · Penetration Readiness  |  Week 9–10', C.red),
      space(120),

      h2('5.1 Objectives'),
      body('Phase 5 hardens the entire platform before launch. Role-based access control is enforced end-to-end, sensitive fields are encrypted at rest, every abuse vector is rate-limited and validated, security headers and CORS are locked down, and the system is prepared for penetration testing. The exit bar is zero critical or high-severity vulnerabilities outstanding.'),
      space(80),

      h2('5.2 Scope & Tasks'),
      h3('RBAC Enforcement'),
      bullet('require_role dependency applied to every protected route per the RBAC matrix (admin / reviewer / auditor)'),
      bullet('admin: manage users, delete documents, manage checklists, view everything'),
      bullet('reviewer: upload, review, annotate, approve/reject, download reports'),
      bullet('auditor: read-only — view documents, violations, and audit logs; no write actions'),
      bullet('Frontend route guards mirror backend roles; the UI hides actions a role cannot perform'),
      bullet('Default role on register = reviewer; first user promoted to admin via seed script or manual MongoDB update'),

      h3('Field-Level Encryption'),
      bullet('extracted_text encrypted with AES-256 Fernet (cryptography) before MongoDB insert; decrypted only in-memory during processing'),
      bullet('FIELD_ENCRYPTION_KEY loaded from .env — never hardcoded or committed'),
      bullet('Verify ciphertext at rest (gAAA Fernet prefix); plaintext is never persisted'),

      h3('Rate Limiting'),
      bullet('slowapi limiter wired into FastAPI with a sensible global default'),
      bullet('10 requests/min on POST /api/documents/upload'),
      bullet('30 requests/min on POST /api/compliance/validate/:id'),
      bullet('429 Too Many Requests returned on breach, with Retry-After header'),

      h3('File Validation & Storage Safety'),
      bullet('python-magic magic-bytes validation on every upload (not the file extension)'),
      bullet('Reject spoofed extensions and forbidden types with 415'),
      bullet(USE_LOCAL
        ? 'Download endpoints resolve and confirm the path stays within LOCAL_STORAGE_DIR — path traversal (../) is rejected'
        : 'All file access via pre-signed URLs only; the S3 bucket blocks all public access'),

      h3('JWT & Session Hardening'),
      bullet('Refresh token JTI blacklisted in Redis on logout (TTL matches the refresh-token expiry)'),
      bullet('Access token kept in memory only; refresh token in an httpOnly, Secure, SameSite cookie'),
      bullet('Blacklist is checked on every refresh request'),

      h3('Transport, Headers & CORS'),
      bullet('Security headers middleware: X-Content-Type-Options=nosniff, X-Frame-Options=DENY, X-XSS-Protection, Strict-Transport-Security (production)'),
      bullet('CORS whitelists only ALLOWED_ORIGINS — no wildcard origins'),
      bullet('All secrets sourced from .env; nothing hardcoded or committed to source control'),

      h3('Penetration Readiness'),
      bullet('Dependency vulnerability scan (pip-audit + npm audit) — zero critical/high findings'),
      bullet('Manual test pass: auth bypass, IDOR on document IDs, privilege escalation, path traversal on download, injection on search params'),
      bullet('No raw string queries to MongoDB — Motor (async) used throughout'),

      space(120),
      h2('5.3 Deliverables'),
      delivTable([
        ['RBAC Enforcement',       'require_role on all protected routes; frontend guards mirror roles', 'Backend Dev', 'Every endpoint enforces the correct role; auditor is strictly read-only'],
        ['Field Encryption',       'AES-256 Fernet applied to extracted_text', 'Backend Dev', 'Ciphertext at rest; key loaded only from .env'],
        ['Rate Limiting',          'slowapi: 10/min upload, 30/min validate, global default', 'Backend Dev', '429 returned beyond limits; legitimate traffic unaffected'],
        ['Security Headers + CORS','Headers middleware; ALLOWED_ORIGINS whitelist', 'Backend Dev', 'Headers present on responses; non-whitelisted origins blocked'],
        ['Magic-Bytes Validation', 'python-magic enforced on all uploads', 'Backend Dev', 'Spoofed and forbidden types rejected with 415'],
        ['JWT Blacklist',          'Redis blacklist enforced on logout and refresh', 'Backend Dev', 'Revoked refresh tokens rejected with 401'],
        ['Vulnerability Scan',     'pip-audit + npm audit clean', 'Full Stack', 'Zero critical/high vulnerabilities outstanding'],
      ]),

      space(120),
      h2('5.4 Phase 5 QA Gate'),
      body('This is the final gate before launch. Every security test must PASS and the dependency scan must show zero critical/high findings.'),
      space(80),

      h3('Security & Hardening Tests'),
      qaTable([
        ['Auditor cannot upload',                          'Security',    'auditor role on POST /upload returns 403',                       'Status 403; no document created'],
        ['Auditor cannot approve or reject',               'Security',    'auditor PATCH approve/reject returns 403',                       'Status 403; approval_status unchanged'],
        ['Reviewer cannot delete a document',              'Security',    'reviewer DELETE /documents/:id returns 403',                     'Status 403; only admin can delete'],
        ['Reviewer cannot access admin users API',         'Security',    'reviewer GET /api/users returns 403',                            'Status 403'],
        ['IDOR: role scope enforced on document access',   'Security',    'Document-ID guessing does not leak data beyond role scope',       'Access governed by role; no unauthorized data returned'],
        ['Upload rate limit enforced',                     'Performance', '11th upload within one minute returns 429',                      'Status 429 on the 11th request; Retry-After present'],
        ['Validation rate limit enforced',                'Performance', '31st validate within one minute returns 429',                    'Status 429 on the 31st request'],
        ['Magic-bytes rejects spoofed file',               'Security',    'PNG renamed .pdf rejected on upload',                            'Status 415'],
        ['Forbidden file type rejected',                   'Security',    '.exe upload rejected',                                           'Status 415; nothing stored'],
        ['extracted_text encrypted at rest',               'Security',    'MongoDB extracted_text value is Fernet ciphertext',              'Starts with gAAA; no plaintext present'],
        ['Logout blacklists refresh token',                'Security',    'Post-logout refresh returns 401',                                'JTI in Redis blacklist; status 401'],
        ['Access token never in localStorage',             'Security',    'Token held in memory only; refresh in httpOnly cookie',          'localStorage holds no tokens; refresh cookie is httpOnly'],
        ['CORS blocks non-whitelisted origin',             'Security',    'Request from an unlisted origin is blocked',                     'No Access-Control-Allow-Origin for the unlisted origin'],
        ['Security headers present on responses',          'Security',    'X-Content-Type-Options, X-Frame-Options, X-XSS-Protection set',   'All headers present on API responses'],
        ['Path traversal on download blocked',             'Security',    USE_LOCAL ? 'Download with ../ resolves within storage dir only' : 'Direct S3 path returns 403; only pre-signed URLs work', USE_LOCAL ? 'Status 400/403; no file outside ./storage served' : '403 on raw bucket URL'],
        ['Expired access token rejected',                  'Security',    'Request with an expired JWT returns 401',                        'Status 401'],
        ['Password stored as bcrypt hash only',            'Security',    'No plaintext password anywhere in the system',                   'hashed_password starts with $2b$12$'],
        ['Dependency scan clean',                          'Security',    'pip-audit and npm audit show no critical/high findings',          'Zero critical/high vulnerabilities'],
      ]),

      space(120),
      h2('5.5 Phase 5 Risk Register'),
      riskTable([
        ['A protected route missed during the RBAC sweep',          'Medium', 'High', 'Automated test asserting every endpoint rejects unauthorized roles'],
        ['Fernet key rotation breaks decryption of existing data',  'Low',    'High', 'Document a key-rotation procedure; version encrypted fields'],
        ['Rate limits block legitimate burst uploads',              'Medium', 'Low',  'Tune limits with stakeholders; allow an admin override path'],
        ['Penetration test surfaces a late-stage critical bug',     'Medium', 'High', 'Schedule the pen-test mid-phase with buffer for remediation before launch'],
      ]),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  2. PROGRAM-LEVEL DEFINITION OF DONE
      // ══════════════════════════════════════════════════════════════════════
      new Paragraph({ children: [new PageBreak()] }),
      h1('2. Program-Level Definition of Done'),
      divider(),
      body('The program is considered complete and ready for launch only when all of the following hold simultaneously:'),
      space(40),
      bullet('All five phase QA gates passed with zero FAIL results'),
      bullet('Zero critical or high-severity security vulnerabilities outstanding'),
      bullet('End-to-end workflow verified: upload → extract → classify → validate → summarise → review → approve/reject → report download'),
      bullet('All secrets externalised to .env; no credentials committed to source control'),
      bullet('docker-compose up --build brings the full stack online on a clean machine'),
      bullet('README documents setup, environment variables, and first-admin seeding'),

      space(200),

      // ══════════════════════════════════════════════════════════════════════
      //  3. SIGN-OFF
      // ══════════════════════════════════════════════════════════════════════
      h1('3. Sign-off'),
      divider(),
      body('Each signatory confirms that the deliverables and QA gates for their area of responsibility have been met before the project proceeds to launch.'),
      space(80),
      signoffTable(['Project Lead', 'Backend Lead', 'Frontend Lead', 'Security Reviewer', 'Product Owner']),

      space(120),
      body('Document generated for the DocuGuard programme. Storage architecture: '
        + (USE_LOCAL ? 'local filesystem (./storage) served via authenticated download endpoints.' : 'AWS S3 with private bucket and pre-signed URLs.'),
        { italic: true, color: C.mid, size: 18 }),
    ]
  }]
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('Wrote ' + OUT + ' (' + buf.length + ' bytes) — storage mode: ' + (USE_LOCAL ? 'local' : 's3'));
});
