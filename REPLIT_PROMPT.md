# Replit AI Prompt — Add PDF Conversion Features

## Context

This is a full-stack PDF tools web app:
- **Backend**: Python Flask (`backend/server.py`)
- **Frontend**: React + Vite + Tailwind CSS (`frontend/src/`)
- **Tool definitions**: `frontend/src/tools.js` — this is the single source of truth for what tools appear in the UI
- **Tool modal**: `frontend/src/components/ToolModal.jsx` — renders the file dropzone and calls the API

The app already has these working tools: Merge PDF, Split PDF, Rotate PDF, Protect PDF, Unlock PDF, PDF to Text, JPG to PDF, PDF Info.

---

## What to add

Add the following **four new backend API endpoints** and **four new tool entries** in `tools.js`.

---

### 1. PDF to JPG (`/api/pdf-to-jpg`)

- Accept: one PDF file (form field `file`)
- Convert **every page** of the PDF to a JPEG image using **PyMuPDF** (`import fitz`)
- Return a ZIP file containing `page_1.jpg`, `page_2.jpg`, etc.
- Use `fitz.open()` to open the PDF, then `page.get_pixmap(dpi=150)` to render each page
- Add `pymupdf` to `requirements.txt`

**Tool entry for `tools.js`** (add inside the `convert-from` category):
```js
{
  id: 'pdf-to-jpg',
  label: 'PDF to JPG',
  description: 'Convert every page of your PDF into a JPG image, delivered as a ZIP.',
  icon: 'Image',
  endpoint: '/api/pdf-to-jpg',
  multiple: false,
  accept: { 'application/pdf': ['.pdf'] },
  fields: [],
  resultType: 'download',
  downloadName: 'pdf_images.zip',
}
```

---

### 2. PDF to Word (`/api/pdf-to-word`)

- Accept: one PDF file (form field `file`)
- Convert to a `.docx` file using **pdf2docx** (`from pdf2docx import Converter`)
- Save the input PDF to a temp file, convert it, return the `.docx` as a download
- Use Python's `tempfile` module for temp files and clean them up after
- Add `pdf2docx` to `requirements.txt`

**Tool entry for `tools.js`** (add inside `convert-from` category):
```js
{
  id: 'pdf-to-word',
  label: 'PDF to Word',
  description: 'Convert your PDF into an editable Word (.docx) document.',
  icon: 'FileText',
  endpoint: '/api/pdf-to-word',
  multiple: false,
  accept: { 'application/pdf': ['.pdf'] },
  fields: [],
  resultType: 'download',
  downloadName: 'converted.docx',
}
```

---

### 3. PDF to Excel (`/api/pdf-to-excel`)

- Accept: one PDF file (form field `file`)
- Extract all tables from the PDF using **camelot-py** (`import camelot`) with `flavor='stream'`
- Write all tables to separate sheets in a single `.xlsx` file using **openpyxl**
- If no tables are found, return a single sheet with the raw extracted text via pypdf
- Add `camelot-py`, `openpyxl`, and `ghostscript` (note: camelot needs ghostscript installed on the system) to `requirements.txt`

**Tool entry for `tools.js`** (add inside `convert-from` category):
```js
{
  id: 'pdf-to-excel',
  label: 'PDF to Excel',
  description: 'Extract tables from your PDF into an Excel (.xlsx) spreadsheet.',
  icon: 'Table',
  endpoint: '/api/pdf-to-excel',
  multiple: false,
  accept: { 'application/pdf': ['.pdf'] },
  fields: [],
  resultType: 'download',
  downloadName: 'converted.xlsx',
}
```

---

### 4. PDF to PowerPoint (`/api/pdf-to-pptx`)

- Accept: one PDF file (form field `file`)
- Create a `.pptx` file using **python-pptx** where each PDF page becomes one slide
- Render each page as an image with PyMuPDF (`fitz`) at 150 DPI, then insert it as a full-slide image in the PPTX
- Slide dimensions should match the PDF page dimensions
- Add `python-pptx` to `requirements.txt` (pymupdf should already be there from PDF to JPG)

**Tool entry for `tools.js`** (add inside `convert-from` category):
```js
{
  id: 'pdf-to-pptx',
  label: 'PDF to PowerPoint',
  description: 'Turn your PDF pages into PowerPoint slides (.pptx).',
  icon: 'Monitor',
  endpoint: '/api/pdf-to-pptx',
  multiple: false,
  accept: { 'application/pdf': ['.pdf'] },
  fields: [],
  resultType: 'download',
  downloadName: 'converted.pptx',
}
```

---

## Important implementation notes

1. **All endpoints must validate** that the uploaded file starts with `%PDF` bytes before processing.
2. **Always use `io.BytesIO` or `tempfile.NamedTemporaryFile`** for intermediate files — never write to a fixed path.
3. **Clean up temp files** in a `finally` block to avoid disk leaks.
4. **CORS is already enabled** via `flask-cors` — do not change the CORS setup.
5. The existing `_require_pdf(file)` helper in `server.py` validates and parses a PDF — reuse it where possible.
6. The `convert-from` category already exists in `tools.js` with one entry (`pdf-to-text`). **Append** the new tools inside that same category array — do not create a new category.
7. Do not change anything outside of `backend/server.py`, `backend/requirements.txt`, and `frontend/src/tools.js`.
