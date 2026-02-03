import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import crypto from 'crypto';
import { createEmbedding } from './local-ai-helper.js';

function chunkText(text, maxChars = 8000, overlapChars = 800) {
  if (!text) return [];
  const len = text.length;
  if (len <= maxChars) return [{ text, start: 0, end: len }];

  const chunks = [];
  let start = 0;
  const minPreferred = Math.floor(maxChars * 0.6);

  while (start < len) {
    let end = Math.min(start + maxChars, len);
    if (end < len) {
      let boundary = -1;
      const searchStart = start + minPreferred;
      for (let i = end - 1; i >= searchStart; i--) {
        const ch = text.charAt(i);
        if (ch === '.' || ch === '!' || ch === '?') {

          const next = text.charAt(i + 1);
          if (!next || /\s/.test(next)) { boundary = i + 1; break; }
        }
      }
      if (boundary > 0 && boundary > start) {
        end = boundary;
      }
    }

    chunks.push({ text: text.slice(start, end), start, end });

    if (end >= len) break;

    start = Math.max(0, end - overlapChars);

    if (start >= len) break;
    if (chunks.length > 10000) {

      break;
    }
  }

  return chunks;
}

async function createAndStoreEmbeddingsForLongText(text, meta = {}) {
  try {
    if (!text || String(text).trim().length === 0) return 0;

    const requestedMaxTokens = typeof meta.maxTokens === 'number' ? meta.maxTokens : 8000;
    const maxTokens = Math.min(requestedMaxTokens, 4096);
    const overlapTokens = typeof meta.overlapTokens === 'number' ? meta.overlapTokens : Math.floor(maxTokens * 0.08);

  const maxChars = Math.floor(maxTokens * 4);
  const overlapChars = Math.floor(overlapTokens * 4);
  const chunkObjs = chunkText(String(text), maxChars, overlapChars);
  if (!chunkObjs || !chunkObjs.length) return 0;
  const chunks = chunkObjs; 

    const embeddingsFile = path.join(app.getPath('userData'), 'embeddings.json');
    let existing = [];
    try {
      if (fs.existsSync(embeddingsFile)) {
        const raw = fs.readFileSync(embeddingsFile, 'utf8') || '[]';
        existing = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[embeddings-helper] could not read existing embeddings file, continuing with empty array:', e && e.message ? e.message : e);
      existing = [];
    }

    const originalLength = String(text).length;
    const originalHash = crypto.createHash('sha256').update(String(text)).digest('hex');
    let stored = 0;
    const totalChunks = chunks.length;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        // Használjuk a local-ai-helper-t, ami először helyi AI-t próbál, utána OpenAI fallback
        const emb = await createEmbedding(String(chunk.text || chunk));
        if (emb && Array.isArray(emb)) {
          const entry = {
            embedding: emb,
            filename: meta.filename || null,
            sourceId: meta.sourceId || null,
            chunkIndex: i,
            chunkStart: typeof chunk.start === 'number' ? chunk.start : null,
            chunkEnd: typeof chunk.end === 'number' ? chunk.end : null,
            totalChunks,
            originalLength,
            originalHash,
            textSnippet: String(chunk.text || '').replace(/\s+/g, ' ').slice(0, 1000),
            createdAt: (new Date()).toISOString()
          };
          existing.push(entry);
          stored += 1;
        }
      } catch (e) {
        console.error('[embeddings-helper] embedding creation error for chunk', i, e && e.message ? e.message : e);
      }
    }

    try {
      fs.writeFileSync(embeddingsFile, JSON.stringify(existing, null, 2), 'utf8');
    } catch (we) {
      console.error('[embeddings-helper] failed to write embeddings file:', we && we.message ? we.message : we);
    }

    try {
      const kbFile = path.join(app.getPath('userData'), 'embeddings_kb.json');
      let kbExisting = [];
      try {
        if (fs.existsSync(kbFile)) kbExisting = JSON.parse(fs.readFileSync(kbFile, 'utf8') || '[]');
      } catch (re) {
        kbExisting = [];
      }

      const baseDocId = meta.sourceId ? String(meta.sourceId) : (meta.filename ? `file-${String(meta.filename)}` : `file-${originalHash.slice(0,8)}`);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const id = `${baseDocId}-${i}`;
        if (kbExisting.find(x => x.id === id)) continue;
        const kbEntry = {
          id,
          docId: baseDocId,
          chunkIndex: i,
          text: String(chunk.text || ''),
          subject: meta.filename || null,
          from: meta.from || null,
          date: meta.date || null,
          embedding: null, 
          chunkStart: typeof chunk.start === 'number' ? chunk.start : null,
          chunkEnd: typeof chunk.end === 'number' ? chunk.end : null,
          totalChunks
        };

        const e = existing.find((ex, idx) => ex.chunkIndex === i && (ex.sourceId === meta.sourceId || true));
        if (e && e.embedding) kbEntry.embedding = e.embedding;
        kbExisting.push(kbEntry);
      }
      try {
        fs.writeFileSync(kbFile, JSON.stringify(kbExisting, null, 2), 'utf8');
      } catch (we) {
        console.error('[embeddings-helper] failed to write KB file:', we && we.message ? we.message : we);
      }
    } catch (kbMirrorErr) {
      console.error('[embeddings-helper] failed to mirror embeddings into KB:', kbMirrorErr && kbMirrorErr.message ? kbMirrorErr.message : kbMirrorErr);
    }

    return stored;
  } catch (err) {
    console.error('[embeddings-helper] createAndStoreEmbeddingsForLongText error:', err && err.message ? err.message : err);
    return 0;
  }
}

export { chunkText, createAndStoreEmbeddingsForLongText };
