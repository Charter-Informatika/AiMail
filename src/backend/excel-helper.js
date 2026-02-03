import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { findFile } from '../utils/findFile.js';

export async function readExcelDataWithImages() {
  try {
    const excelFile = path.join(app.getPath('userData'), 'adatok.xlsx');
    if (fs.existsSync(excelFile)) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelFile);
      const allData = {};
      const allImages = [];
      workbook.eachSheet((worksheet, sheetId) => {
        const rows = [];
        worksheet.eachRow((row, rowNumber) => {
          rows.push(row.values);
        });
        allData[worksheet.name] = rows;
      });
      workbook.media.forEach((media, idx) => {
        if (media.type === 'image') {
          allImages.push({
            buffer: media.buffer,
            extension: media.extension || 'png',
            base64: `data:image/${media.extension || 'png'};base64,${media.buffer.toString('base64')}`
          });
        }
      });
      return { allData, allImages };
    }
  } catch (err) {
    console.error('Hiba az Excel fájl beolvasásakor (képekkel):', err);
  }
  return { allData: {}, allImages: [] };
}

export function excelExists() {
  try {
    const userDataExcel = path.join(app.getPath('userData'), 'adatok.xlsx');
    if (fs.existsSync(userDataExcel)) return true;

    try {
      const excelFile = findFile('adatok.xlsx');
      return fs.existsSync(excelFile);
    } catch (e) {
      return false;
    }
  } catch (e) {
    console.error('excel-exists error', e);
    return false;
  }
}

export function getExcelPath() {
  try {
    const userDataExcel = path.join(app.getPath('userData'), 'adatok.xlsx');
    if (fs.existsSync(userDataExcel)) return userDataExcel;

    try {
      const excelFile = findFile('adatok.xlsx');
      return fs.existsSync(excelFile) ? excelFile : null;
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

export function readExcelFile() {
  try {
    let excelFile = path.join(app.getPath('userData'), 'adatok.xlsx');
    if (!fs.existsSync(excelFile)) {
      try {
        excelFile = findFile('adatok.xlsx');
      } catch (e) {
        return { success: false, error: 'No file' };
      }
    }

    const workbook = XLSX.readFile(excelFile, { cellDates: true });
    const sheets = workbook.SheetNames.map((name) => {
      const ws = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      return { name, data };
    });
    return { success: true, sheets };
  } catch (error) {
    console.error('read-excel-file error', error);
    return { success: false, error: error.message };
  }
}

export async function saveExcelFile(payload) {
  try {
    if (!payload || !Array.isArray(payload.sheets)) throw new Error('Invalid payload');
    const workbook = new ExcelJS.Workbook();
    for (const sheet of payload.sheets) {
      const ws = workbook.addWorksheet(sheet.name || 'Sheet');
      (sheet.data || []).forEach((row) => {
        ws.addRow(row);
      });
    }
    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    const targetPath = path.join(userDataDir, 'adatok.xlsx');
    await workbook.xlsx.writeFile(targetPath);
    return { success: true };
  } catch (error) {
    console.error('save-excel-file error', error);
    return { success: false, error: error.message };
  }
}

export function uploadExcelFile(fileContent) {
  try {
    let contentBuffer = null;
    let originalPath = null;
    if (fileContent && typeof fileContent === 'object' && (fileContent.content || fileContent.originalPath)) {
      if (fileContent.content) contentBuffer = Buffer.from(fileContent.content);
      if (fileContent.originalPath) originalPath = fileContent.originalPath;
    } else {
      contentBuffer = Buffer.from(fileContent);
    }

    const userDataDir = app.getPath('userData');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    const targetPath = path.join(userDataDir, 'adatok.xlsx');

    fs.writeFileSync(targetPath, contentBuffer);

    const workbook = XLSX.readFile(targetPath);
    if (!workbook.SheetNames || !workbook.SheetNames.length) {
      try { fs.unlinkSync(targetPath); } catch (e) {}
      throw new Error('Az Excel fájl üres vagy nem olvasható!');
    }

    let filename = null;
    try {
      if (originalPath) filename = path.basename(originalPath);
    } catch (e) {
      filename = null;
    }

    return { success: true, path: targetPath, filename };
  } catch (error) {
    console.error('Hiba az Excel fájl feltöltésekor:', error);
    return { success: false, error: error.message };
  }
}

export async function findExcelCell({ cellAddress, sheet, colLetter, row } = {}) {
  try {
    const normalize = (s) => {
      if (!s) return '';
      try {
        return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
      } catch (e) {
        return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      }
    };

    let targetSheet = sheet || null;
    let targetCol = colLetter || null;
    let targetRow = typeof row === 'number' ? Number(row) : (row ? Number(row) : null);
    if (cellAddress && (!targetSheet || !targetCol || !targetRow)) {
      const m = String(cellAddress).trim().match(/^([^!\t\n\r]+)[!\s]+([A-Za-z]+)\s*-?\s*(\d+)$/);
      if (m) {
        targetSheet = m[1].trim();
        targetCol = m[2].trim();
        targetRow = Number(m[3]);
      }
    }

    const normalizedSheet = normalize(targetSheet || '');
    const normalizedCol = targetCol ? String(targetCol).toUpperCase().replace(/\s+/g, '') : null;

    const kbFile = path.join(app.getPath('userData'), 'embeddings_kb.json');
    let kbExisting = [];
    try {
      if (fs.existsSync(kbFile)) kbExisting = JSON.parse(fs.readFileSync(kbFile, 'utf8') || '[]');
    } catch (e) {
      kbExisting = [];
    }

    const matches = kbExisting.filter(ent => {
      try {
        if (!ent) return false;
        if (normalizedSheet && normalize(ent.subject || '') !== normalizedSheet) return false;
        if (normalizedCol && String(ent.colLetter || '').toUpperCase() !== normalizedCol) return false;
        if (targetRow && Number(ent.row) !== Number(targetRow)) return false;
        return true;
      } catch (e) { return false; }
    });

    if (matches.length) {
      matches.sort((a, b) => (Number(a.chunkIndex) || 0) - (Number(b.chunkIndex) || 0));
      const full = matches.map(m => String(m.text || m.textSnippet || '')).join('');
      return { success: true, source: 'kb', matches, text: full };
    }

    const embFile = path.join(app.getPath('userData'), 'embeddings.json');
    try {
      if (fs.existsSync(embFile)) {
        const raw = JSON.parse(fs.readFileSync(embFile, 'utf8') || '[]');
        const key = (cellAddress || `${targetSheet || ''}!${targetCol || ''}${targetRow || ''}`).trim();
        const fallback = raw.filter(r => {
          try {
            const src = String(r.source || r.title || '').toLowerCase();
            return key && src && src.toLowerCase().includes(key.toLowerCase());
          } catch (e) { return false; }
        });
        if (fallback.length) {
          fallback.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));
          const full = fallback.map(f => String(f.textSnippet || f.text || f.content || '')).join('');
          return { success: true, source: 'embeddings', matches: fallback, text: full };
        }
      }
    } catch (e) {
      // ignore
    }

    return { success: false, error: 'No matching cell found' };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
}
