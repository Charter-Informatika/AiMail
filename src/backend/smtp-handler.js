import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import XLSX from 'xlsx';
import mammoth from 'mammoth';
import { htmlToText } from 'html-to-text';
import * as cheerio from 'cheerio';
import kbManager from './kb-manager.js';
import { createAndStoreEmbeddingsForLongText } from './embeddings-helper.js';
import { describeImage } from './local-ai-helper.js';

function decodeRFC2047(subject) {
  if (!subject) return '';
  return subject.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (match, charset, encoding, text) => {
    if (encoding.toUpperCase() === 'B') {
      const buff = Buffer.from(text, 'base64');
      return buff.toString(charset);
    } else if (encoding.toUpperCase() === 'Q') {
      const str = text.replace(/_/g, ' ');
      const buff = Buffer.from(str.replace(/=([A-Fa-f0-9]{2})/g, (m, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }), 'binary');
      return buff.toString(charset);
    }
    return text;
  });
}


function htmlToTextWithTables(html) {
  try {
    let text = htmlToText(html, { wordwrap: 130 });
    let $ = null;
    try { $ = cheerio.load(html); } catch (e) { $ = null; }
    if ($) {
      const tables = $('table');
      if (tables.length > 0) {
        text += '\n\n[TABLES]\n';
        tables.each((ti, table) => {
          const rows = [];
          $(table).find('tr').each((ri, tr) => {
            const cells = [];
            $(tr).find('th,td').each((ci, cell) => {
              let cellText = $(cell).text().trim().replace(/\s+/g, ' ');
              cellText = cellText.replace(/\n+/g, ' ');
              cells.push(cellText);
            });
            if (cells.length) rows.push(cells.join('\t'));
          });
          if (rows.length) {
            text += `Table ${ti + 1}:\n` + rows.join('\n') + '\n\n';
          }
        });
      }
    }
    return text;
  } catch (e) {
    try { return htmlToText(html); } catch { return '(html parsing error)'; }
  }
}

/**
 * Csatolt dokumentum feldolgozása és beágyazása (PDF, Excel, Word, EML)
 * @param {Buffer} content - Fájl tartalma
 * @param {string} filename - Fájlnév
 * @param {string} mimeType - MIME típus
 * @param {object} emailMeta - Email metaadatok (from, subject, date)
 * @param {string} sourceId - Forrás azonosító
 */
async function processAndEmbedAttachment(content, filename, mimeType, emailMeta = {}, sourceId = null) {
  try {
    const lower = (filename || '').toLowerCase();
    const mt = (mimeType || '').toLowerCase();
    let extracted = '';


    if (lower.endsWith('.pdf') || mt.includes('pdf')) {
      try {
        const pdfRes = await pdfParse(content);
        extracted = pdfRes && pdfRes.text ? String(pdfRes.text) : '';
      } catch (pe) {
        console.error('[smtp-handler] pdf parse error:', pe?.message || pe);
      }
    }


    else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mt.includes('spreadsheet')) {
      try {
        const wb = XLSX.read(content, { type: 'buffer' });
        const sheets = wb.SheetNames || [];
        const parts = [];
        const cellKBs = [];

        for (const sname of sheets) {
          try {
            const sh = wb.Sheets[sname];
            const csv = XLSX.utils.sheet_to_csv(sh || {});
            if (csv) parts.push(`Sheet: ${sname}\n${csv}`);

 
            const rows = XLSX.utils.sheet_to_json(sh || {}, { header: 1, raw: false, defval: '' });
            for (let r = 0; r < rows.length; r++) {
              const row = rows[r] || [];
              for (let c = 0; c < row.length; c++) {
                try {
                  const val = row[c];
                  if (val === null || val === undefined) continue;
                  const sval = String(val).trim();
                  if (!sval) continue;
                  
                  let addr = null;
                  try { addr = XLSX.utils.encode_cell({ r, c }); } catch (ea) { addr = `${r + 1}:${c + 1}`; }
                  
                  let col = c + 1;
                  let colLetter = '';
                  while (col > 0) {
                    const rem = (col - 1) % 26;
                    colLetter = String.fromCharCode(65 + rem) + colLetter;
                    col = Math.floor((col - 1) / 26);
                  }
                  
                  const cellAddress = `${sname}!${colLetter}${r + 1}`;
                  const cellId = `${sourceId || Date.now()}-att-${filename}-sheet-${sname}-cell-${addr}`;
                  
                  cellKBs.push({
                    id: cellId,
                    from: emailMeta.from || '',
                    subject: emailMeta.subject || `Attachment: ${filename} [${sname} ${addr}]`,
                    date: emailMeta.date || new Date().toISOString(),
                    body: sval,
                    sheet: sname,
                    colLetter,
                    row: r + 1,
                    cellAddress
                  });
                } catch (cellErr) {
                  // ignore single cell errors
                }
              }
            }
          } catch (se) { /* ignore sheet errors */ }
        }
        extracted = parts.join('\n\n');

        // Add per-cell KB entries
        if (cellKBs.length) {
          try {
            await kbManager.addEmails(cellKBs);
          } catch (kbErr) {
            console.error('[smtp-handler] failed to add per-cell KB entries:', kbErr?.message || kbErr);
          }
        }
      } catch (xe) {
        console.error('[smtp-handler] xlsx parse error:', xe?.message || xe);
      }
    }
    // Word dokumentum feldolgozás
    else if (lower.endsWith('.docx') || mt.includes('word')) {
      try {
        const mm = await mammoth.extractRawText({ buffer: content });
        extracted = mm && mm.value ? String(mm.value) : '';
      } catch (me) {
        console.error('[smtp-handler] mammoth parse error:', me?.message || me);
      }
    }
    // EML (beágyazott email) feldolgozás
    else if (lower.endsWith('.eml') || mt.includes('message/rfc822')) {
      try {
        const parsedAtt = await simpleParser(content);
        extracted = parsedAtt && parsedAtt.text ? String(parsedAtt.text) : '';
      } catch (ee) {
        console.error('[smtp-handler] eml parse error:', ee?.message || ee);
      }
    }
    // Szöveges fájlok
    else if (mt.startsWith('text/')) {
      try {
        extracted = content.toString('utf8');
      } catch (te) {
        console.error('[smtp-handler] text attachment read error:', te?.message || te);
      }
    }

    // Ha van kinyert szöveg, hozzáadjuk a KB-hez és készítünk embeddingeket
    if (extracted && extracted.length > 10) {
      try {
        const kbEmail = {
          id: `${sourceId || Date.now()}-att-${filename}`,
          from: emailMeta.from || '',
          subject: emailMeta.subject || `Attachment: ${filename}`,
          date: emailMeta.date || new Date().toISOString(),
          body: extracted
        };
        await kbManager.addEmails([kbEmail]);

        // Embeddings létrehozása
        try {
          await createAndStoreEmbeddingsForLongText(extracted, { 
            filename, 
            sourceId: sourceId || null, 
            maxTokens: 2000 
          });
        } catch (embErr) {
          console.error('[smtp-handler] embedding helper error:', embErr?.message || embErr);
        }
      } catch (ke) {
        console.error('[smtp-handler] kbManager.addEmails error:', ke?.message || ke);
      }
    }

    return extracted;
  } catch (err) {
    console.error('[smtp-handler] processAndEmbedAttachment error:', err?.message || err);
    return null;
  }
}

function extractInlineImagesFromHtml(html) {
  const images = [];
  if (!html) return images;
  
  try {
    // Base64 inline képek keresése
    const regex = /data:(image\/[^;]+);base64,([^"'\s>]+)/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      images.push({
        mimeType: match[1],
        data: match[2],
        base64: match[0]
      });
    }
  } catch (e) {
    console.error('[smtp-handler] extractInlineImagesFromHtml error:', e?.message || e);
  }
  
  return images;
}

function extractBodyFromParsed(parsed) {
  // Ha van text, használjuk azt
  if (parsed.text && parsed.text.trim().length > 0) {
    return parsed.text;
  }
  
  // Ha csak HTML van, konvertáljuk
  if (parsed.html) {
    return htmlToTextWithTables(parsed.html);
  }
  
  return '(nincs tartalom)';
}

// Cache configuration
const FETCH_CONFIG = {
  minFetchInterval: 30000, 
  metadataOnlyInterval: 10000, 
  maxCacheAge: 300000,
};

class SmtpEmailHandler {
  constructor(config) {
    this.config = config;
    this.transporter = null;
    this.imap = null;
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.keepaliveInterval = null;
    this.onMailCallback = null;
    
    // Email caching to reduce IMAP fetches
    this._emailCache = new Map(); 
    this._lastFetchTime = 0;
    this._lastFullFetchTime = 0;
    this._cachedIds = new Set();
    this._fetchInProgress = false;
  }
  
  /**
   * Check if enough time has passed since last fetch
   * @param {boolean} metadataOnly - Use shorter interval for metadata checks
   * @returns {boolean}
   */
  _canFetch(metadataOnly = false) {
    const now = Date.now();
    const interval = metadataOnly ? FETCH_CONFIG.metadataOnlyInterval : FETCH_CONFIG.minFetchInterval;
    return (now - this._lastFetchTime) >= interval;
  }
  
  /**
   * Check if cache is stale and needs full refresh
   * @returns {boolean}
   */
  _isCacheStale() {
    return (Date.now() - this._lastFullFetchTime) >= FETCH_CONFIG.maxCacheAge;
  }
  
  /**
   * Get cached emails without fetching
   * @returns {Array}
   */
  getCachedEmails() {
    return Array.from(this._emailCache.values());
  }
  

  clearCache() {
    this._emailCache.clear();
    this._cachedIds.clear();
    this._lastFetchTime = 0;
    this._lastFullFetchTime = 0;
    console.log('[SmtpEmailHandler] Cache cleared');
  }

  async connect() {
    try {
      console.log('Creating SMTP transport with config:', {
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: true,
        auth: {
          user: this.config.email
        }
      });

      this.transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: true,
        auth: {
          user: this.config.email,
          pass: this.config.password
        },
        tls: {
          rejectUnauthorized: false
        },
        debug: true,
        logger: true,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
      });

      console.log('Creating IMAP connection with config:', {
        host: this.config.imapHost,
        port: this.config.imapPort,
        tls: true,
        user: this.config.email
      });

      await this.setupImap();

      // Test SMTP connection
      console.log('Testing SMTP connection...');
      await this.testSmtpConnection();
      console.log('SMTP connection test successful');
      
      // Test IMAP connection
      console.log('Testing IMAP connection...');
      await this.testImapConnection();
      console.log('IMAP connection test successful');
      
      return true;
    } catch (error) {
      console.error('Kapcsolódási hiba:', error);
      if (error.code) console.error('Error code:', error.code);
      if (error.command) console.error('Failed command:', error.command);
      return false;
    }
  }

  async disconnect() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }

    if (this.imap && this.imap.state !== 'disconnected') {
      try {
        await new Promise((resolve) => {
          const cleanup = () => {
            try {
              if (this.imap) {
                this.imap.removeAllListeners();
              }
            } catch (err) {
              console.error('Error removing listeners:', err);
            }
            resolve();
          };
          
          // Set timeout to prevent hanging
          const timeoutId = setTimeout(() => {
            console.log('Disconnect timeout - forcing cleanup');
            cleanup();
          }, 5000);
          
          this.imap.once('end', () => {
            clearTimeout(timeoutId);
            cleanup();
          });
          
          this.imap.once('close', () => {
            clearTimeout(timeoutId);
            cleanup();
          });
          
          this.imap.once('error', (err) => {
            console.error('Error during disconnect:', err);
            clearTimeout(timeoutId);
            cleanup();
          });
          
          try {
            this.imap.end();
          } catch (err) {
            console.error('Error ending connection:', err);
            cleanup();
          }
        });
      } catch (error) {
        console.error('Error in disconnect:', error);
      }
    }
    
    // Always ensure imap is nullified at the end
    this.imap = null;
  }

  async setupImap() {
    try {
      // Clean up existing connection first
      await this.disconnect();

      this.imap = new Imap({
        user: this.config.email,
        password: this.config.password,
        host: this.config.imapHost,
        port: this.config.imapPort,
        tls: true,
        tlsOptions: {
          rejectUnauthorized: false
        },
        keepalive: true,
        debug: console.log,
        authTimeout: 60000,
        connTimeout: 60000,
        socketTimeout: 0,
        autotls: 'always'
      });

      // Set up error handler first
      this.imap.on('error', async (err) => {
        console.error('IMAP error:', err);
        if (err.source === 'timeout' || err.code === 'EAUTH') {
          console.log('Authentication or timeout error, attempting reconnect...');
          await this.handleDisconnect();
        } else if (this.imap && this.imap.state !== 'disconnected') {
          await this.handleDisconnect();
        }
      });

      // Handle unexpected disconnections
      this.imap.on('close', async () => {
        console.log('IMAP connection closed unexpectedly');
        await this.handleDisconnect();
      });

      // Notify about new mail immediately so the app can fetch and cache
      this.imap.on('mail', async (numNew) => {
        try {
          console.log('IMAP mail event, new messages count:', numNew);
          if (typeof this.onMailCallback === 'function') {
            // call without awaiting to avoid blocking IMAP event loop
            try { this.onMailCallback(numNew); } catch (e) { console.error('onMailCallback error:', e); }
          }
        } catch (e) {
          console.error('Error handling mail event:', e);
        }
      });

      // Handle end event
      this.imap.on('end', () => {
        console.log('IMAP connection ended');
      });

      return this.imap;
    } catch (error) {
      console.error('Error in setupImap:', error);
      throw error;
    }
  }

  // Allow main process to register a callback invoked when IMAP signals new mail
  setOnMailCallback(cb) {
    this.onMailCallback = cb;
  }
  
  /**
   * Start IDLE monitoring - opens INBOX and keeps it open to receive 'mail' events
   * This is more efficient than polling as it uses IMAP IDLE command
   * @returns {Promise<void>}
   */
  async startIdleMonitoring() {
    if (!this.imap) {
      console.error('[SmtpEmailHandler] Cannot start IDLE: no IMAP connection');
      return;
    }
    
    return new Promise((resolve, reject) => {
      const openAndIdle = () => {
        this.imap.openBox('INBOX', false, (err) => {
          if (err) {
            console.error('[SmtpEmailHandler] Failed to open INBOX for IDLE:', err);
            return reject(err);
          }
          console.log('[SmtpEmailHandler] INBOX opened for IDLE monitoring');

          resolve();
        });
      };
      
      if (this.imap.state === 'authenticated' || this.imap.state === 'selected' || this.imap.state === 'connected') {
        openAndIdle();
      } else {
        this.imap.once('ready', openAndIdle);
        this.imap.once('error', reject);
        if (this.imap.state === 'disconnected') {
          this.imap.connect();
        }
      }
    });
  }
  
  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    return {
      cachedCount: this._emailCache.size,
      lastFetchTime: this._lastFetchTime,
      lastFullFetchTime: this._lastFullFetchTime,
      cacheAge: Date.now() - this._lastFetchTime,
      isStale: this._isCacheStale(),
      canFetch: this._canFetch()
    };
  }

  async handleDisconnect() {
    if (this.isReconnecting) return;
    
    this.isReconnecting = true;
    console.log('Attempting to reconnect...');

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      try {
        this.reconnectAttempts++;
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        await this.setupImap();
        await this.testImapConnection();
        
        console.log('Reconnection successful');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        return true;
      } catch (error) {
        console.error('Reconnection failed:', error);
        // Delay 5 másodperc minden próbálkozás között
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    console.error('Max reconnection attempts reached');
    return false;
  }

  async testSmtpConnection() {
    try {
      await this.transporter.verify();
      console.log('SMTP kapcsolat sikeres');
      return true;
    } catch (error) {
      console.error('SMTP kapcsolódási hiba:', error);
      if (error.code) console.error('Error code:', error.code);
      if (error.command) console.error('Failed command:', error.command);
      throw error;
    }
  }

  async testImapConnection() {
    return new Promise((resolve, reject) => {
      console.log('Attempting IMAP connection...');
      
      const errorHandler = (err) => {
        this.imap.removeListener('ready', readyHandler);
        reject(err);
      };

      const readyHandler = () => {
        this.imap.removeListener('error', errorHandler);
        console.log('IMAP connection successful');
        resolve();
      };

      this.imap.once('error', errorHandler);
      this.imap.once('ready', readyHandler);

      // Only connect if not already connected
      if (this.imap.state !== 'connected') {
        this.imap.connect();
      }
    });
  }

  /**
   * Get unread emails with caching and throttling
   * @param {Object} options - Options object
   * @param {boolean} options.forceRefresh - Force a fresh fetch ignoring cache
   * @param {boolean} options.metadataOnly - Only fetch metadata (faster)
   * @returns {Promise<Array>}
   */
  async getUnreadEmails(options = {}) {
    const { forceRefresh = false, metadataOnly = false } = options;
    
    // Return cached emails if fetch is not allowed and not forcing refresh
    if (!forceRefresh && !this._canFetch(metadataOnly) && this._emailCache.size > 0) {
      console.log('[SmtpEmailHandler] Returning cached emails (throttled)');
      return this.getCachedEmails().filter(e => !e._isRead);
    }
    
    // Prevent concurrent fetches
    if (this._fetchInProgress) {
      console.log('[SmtpEmailHandler] Fetch already in progress, returning cached');
      return this.getCachedEmails().filter(e => !e._isRead);
    }
    
    this._fetchInProgress = true;
    
    return new Promise((resolve, reject) => {
      try {
        if (!this.imap) {
          this._fetchInProgress = false;
          return reject(new Error('IMAP connection is not established.'));
        }
        const emails = [];
        const parsePromises = [];

        const openInbox = (cb) => {
          this.imap.openBox('INBOX', false, (err) => {
            if (err) {
              this._fetchInProgress = false;
              return reject(err);
            }
            cb();
          });
        };

        const processMailbox = () => {
          this.imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              this._fetchInProgress = false;
              return reject(err);
            }

            if (!results.length) {
              // Nincs olvasatlan email - tisztítsuk a cache-t is
              console.log('[SmtpEmailHandler] No unread emails, clearing cache');
              this._emailCache.clear();
              this._cachedIds.clear();
              this._lastFetchTime = Date.now();
              this._fetchInProgress = false;
              return resolve([]);
            }

            const limited = results.slice(-50);
            const currentUnreadIds = new Set(limited.map(id => String(id)));
            
            // FONTOS: Távolítsuk el a cache-ből azokat az emaileket, amik már nem olvasatlanok
            // Ez megakadályozza, hogy a korábban cache-elt de már olvasott emailek megjelenjenek
            for (const cachedId of this._cachedIds) {
              if (!currentUnreadIds.has(String(cachedId))) {
                console.log(`[SmtpEmailHandler] Removing read email from cache: ${cachedId}`);
                this._emailCache.delete(String(cachedId));
                this._cachedIds.delete(cachedId);
              }
            }
            
            // Check which emails we already have cached
            const newIds = limited.filter(id => !this._cachedIds.has(String(id)));
            const cachedEmails = limited
              .filter(id => this._cachedIds.has(String(id)))
              .map(id => this._emailCache.get(String(id)))
              .filter(Boolean);
            
            // If all emails are cached and cache is not stale, return cached
            if (newIds.length === 0 && !this._isCacheStale() && !forceRefresh) {
              console.log('[SmtpEmailHandler] All emails cached, returning cached data');
              this._lastFetchTime = Date.now();
              this._fetchInProgress = false;
              return resolve(cachedEmails);
            }
            
            // Fetch only new emails (or all if cache is stale)
            const idsToFetch = (this._isCacheStale() || forceRefresh) ? limited : newIds;
            
            if (idsToFetch.length === 0) {
              this._lastFetchTime = Date.now();
              this._fetchInProgress = false;
              return resolve(cachedEmails);
            }
            
            console.log(`[SmtpEmailHandler] Fetching ${idsToFetch.length} emails (${newIds.length} new, ${cachedEmails.length} cached)`);

            // Use HEADER.FIELDS for metadata-only fetch, full body otherwise
            const fetchOptions = metadataOnly 
              ? { bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)', struct: false, markSeen: false, uid: true }
              : { bodies: '', struct: true, markSeen: false, uid: true };

            const f = this.imap.fetch(idsToFetch, fetchOptions);

            f.on('message', (msg) => {
              let raw = '';
              let uid = null;

              msg.on('attributes', attrs => {
                uid = attrs.uid;
              });

              msg.on('body', (stream) => {
                stream.on('data', chunk => raw += chunk.toString('utf8'));
              });

              msg.once('end', () => {
                const p = simpleParser(raw)
                  .then(parsed => {
                    // RFC2047 dekódolás a tárgyra
                    const decodedSubject = decodeRFC2047(parsed.subject || '');
                    
                    // Body kinyerése (text preferált, HTML fallback táblázatkezeléssel)
                    const body = extractBodyFromParsed(parsed);
                    
                    const email = {
                      id: uid,
                      from: parsed.from?.text || '',
                      subject: decodedSubject,
                      date: parsed.date ? parsed.date.toISOString() : '',
                      body: body,
                      html: parsed.html || null,
                      text: parsed.text || '',
                      snippet: body.slice(0, 100),
                      _cachedAt: Date.now()
                    };
                    emails.push(email);
                    // Update cache
                    this._emailCache.set(String(uid), email);
                    this._cachedIds.add(String(uid));
                  })
                  .catch(e => console.error('Mail parse hiba (unread):', e));
                parsePromises.push(p);
              });
            });

            f.once('error', err => {
              this._fetchInProgress = false;
              reject(err);
            });
            
            f.once('end', async () => {
              try {
                await Promise.all(parsePromises);
                
                // Merge newly fetched with cached
                const allEmails = [...emails, ...cachedEmails];
                allEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
                
                // Update fetch timestamps
                this._lastFetchTime = Date.now();
                if (!metadataOnly) {
                  this._lastFullFetchTime = Date.now();
                }
                
                this._fetchInProgress = false;
                resolve(allEmails);
              } catch (e) {
                this._fetchInProgress = false;
                reject(e);
              }
            });
          });
        };

        if (this.imap.state === 'authenticated' || this.imap.state === 'selected' || this.imap.state === 'connected') {
          openInbox(processMailbox);
        } else {
          this.imap.once('ready', () => openInbox(processMailbox));
          this.imap.once('error', reject);
          this.imap.connect();
        }
      } catch (err) {
        return reject(err);
      }
    });
  }

  // Return the most recent emails (regardless of read/unread). Limit optional.
  async getRecentEmails(limit = null) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.imap) {
          return reject(new Error('IMAP connection is not established.'));
        }
        const emails = [];
        const parsePromises = [];

        const openInbox = (cb) => {
          this.imap.openBox('INBOX', false, (err) => {
            if (err) return reject(err);
            cb();
          });
        };

        const processMailbox = () => {
          // Try to read `fromDate` from settings.json (format: YYYY-MM-DD)
          // and use a Date object for the SINCE search criterion.
          let searchCriteria = ['ALL'];
          try {
            const settingsPath = path.resolve(process.cwd(), 'settings.json');
            const raw = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(raw);
            const fromDateStr = settings?.fromDate;
            if (fromDateStr && /^\d{4}-\d{2}-\d{2}$/.test(fromDateStr)) {
              // IMAP library expects a Date object for SINCE criterion
              const sinceDate = new Date(fromDateStr);
              searchCriteria = [['SINCE', sinceDate]];
            }
          } catch (e) {
            console.error('[AIServiceApp][smtp-handler.js] settings.json read error:', e.message);
          }

          this.imap.search(searchCriteria, (err, results) => {
            if (err) return reject(err);

            if (!results.length) {
              return resolve([]);
            }

            const limited = (limit && limit > 0) ? results.slice(-limit) : results;

            const f = this.imap.fetch(limited, {
              bodies: '',
              struct: true,
              markSeen: false,
              uid: true
            });

            f.on('message', (msg) => {
              let raw = '';
              let uid = null;

              msg.on('attributes', attrs => {
                uid = attrs.uid;
              });

              msg.on('body', (stream) => {
                stream.on('data', chunk => raw += chunk.toString('utf8'));
              });

              msg.once('end', () => {
                const p = (async () => {
                  const parsed = await simpleParser(raw);
                    // Save attachments (if any) to attachments folder and include metadata
                    const attachmentsArr = [];
                    try {
                      if (Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
                        const attsDir = path.resolve(process.cwd(), 'fromAttachments');
                        if (!fs.existsSync(attsDir)) fs.mkdirSync(attsDir, { recursive: true });
                        for (const a of parsed.attachments) {
                          try {
                            const name = a.filename || `att-${uid}-${Date.now()}`;
                            const safeName = `${uid}-${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                            const filePath = path.join(attsDir, safeName);
                            // write the raw content buffer to disk
                            fs.writeFileSync(filePath, a.content);
                            const b64 = Buffer.from(a.content).toString('base64');
                            // keep the raw buffer for immediate processing
                            attachmentsArr.push({ filename: name, mimeType: a.contentType || 'application/octet-stream', path: filePath, base64: b64, raw: a.content });
                            // start async processing: extract text -> add to KB -> delete file
                            try {
                              // create an async task but don't await here; we'll push to parsePromises later
                              const proc = (async () => {
                                try {
                                  let extracted = '';
                                  const ext = (path.extname(name) || '').toLowerCase();
                                  const mt = (a.contentType || '').toLowerCase();
                                  // PDF
                                  if (ext === '.pdf' || mt.includes('pdf')) {
                                    try {
                                      const pdfRes = await pdfParse(a.content);
                                      extracted = pdfRes && pdfRes.text ? String(pdfRes.text) : '';
                                    } catch (pe) {
                                      console.error('[smtp-handler] pdf parse error:', pe && pe.message ? pe.message : pe);
                                    }
                                  } else if (ext === '.xlsx' || ext === '.xls' || mt.includes('spreadsheet')) {
                                    try {
                                      const wb = XLSX.read(a.content, { type: 'buffer' });
                                      const sheets = wb.SheetNames || [];
                                      const parts = [];
                                      // Collect per-cell KB entries so we can embed/retrieve exact cell values
                                      const cellKBs = [];
                                      for (const sname of sheets) {
                                        try {
                                          const sh = wb.Sheets[sname];
                                          // produce a human-readable CSV fallback for general extracted text
                                          const csv = XLSX.utils.sheet_to_csv(sh || {});
                                          if (csv) parts.push(csv);

                                          // get a 2D array of rows to iterate cells and retain coordinates
                                          const rows = XLSX.utils.sheet_to_json(sh || {}, { header: 1, raw: false, defval: '' });
                                          for (let r = 0; r < rows.length; r++) {
                                            const row = rows[r] || [];
                                            for (let c = 0; c < row.length; c++) {
                                              try {
                                                const val = row[c];
                                                if (val === null || val === undefined) continue;
                                                const sval = String(val).trim();
                                                if (!sval) continue;
                                                // compute A1-style address
                                                let addr = null;
                                                try { addr = XLSX.utils.encode_cell({ r, c }); } catch (ea) { addr = `${r + 1}:${c + 1}`; }
                                                const cellId = `${uid || parsed.messageId || Date.now()}-att-${safeName}-sheet-${sname}-cell-${addr}`;
                                                // compute column letter (A, B, C...)
                                                let col = c + 1;
                                                let colLetter = '';
                                                while (col > 0) {
                                                  const rem = (col - 1) % 26;
                                                  colLetter = String.fromCharCode(65 + rem) + colLetter;
                                                  col = Math.floor((col - 1) / 26);
                                                }
                                                const cellAddress = `${sname}!${colLetter}${r + 1}`;
                                                const kbEmail = {
                                                  id: cellId,
                                                  from: parsed.from?.text || '',
                                                  subject: parsed.subject || `Attachment: ${name} [${sname} ${addr}]`,
                                                  date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
                                                  body: sval,
                                                  sheet: sname,
                                                  colLetter,
                                                  row: r + 1,
                                                  cellAddress
                                                };
                                                cellKBs.push(kbEmail);
                                              } catch (cellErr) {
                                                // ignore single cell errors
                                              }
                                            }
                                          }
                                        } catch (se) { /* ignore sheet errors */ }
                                      }
                                      extracted = parts.join('\n\n');

                                      // If we collected cell-level entries, add them to the KB so
                                      // embeddings are created per cell and exact cell retrieval
                                      // becomes possible. This is async but we await here so the
                                      // mailbox processing includes it.
                                      try {
                                        if (cellKBs.length) {
                                          // batch-add cells to KB (kb-manager will handle embedding)
                                          await kbManager.addEmails(cellKBs);
                                        }
                                      } catch (kbCellErr) {
                                        console.error('[smtp-handler] failed to add per-cell KB entries:', kbCellErr && kbCellErr.message ? kbCellErr.message : kbCellErr);
                                      }
                                    } catch (xe) {
                                      console.error('[smtp-handler] xlsx parse error:', xe && xe.message ? xe.message : xe);
                                    }
                                  } else if (ext === '.docx' || mt.includes('word')) {
                                    try {
                                      const mm = await mammoth.extractRawText({ buffer: a.content });
                                      extracted = mm && mm.value ? String(mm.value) : '';
                                    } catch (me) {
                                      console.error('[smtp-handler] mammoth parse error:', me && me.message ? me.message : me);
                                    }
                                  } else if (ext === '.eml' || mt.includes('message/rfc822')) {
                                    try {
                                      const parsedAtt = await simpleParser(a.content);
                                      extracted = parsedAtt && parsedAtt.text ? String(parsedAtt.text) : '';
                                    } catch (ee) {
                                      console.error('[smtp-handler] eml parse error:', ee && ee.message ? ee.message : ee);
                                    }
                                  } else if (mt.startsWith('text/')) {
                                    try {
                                      extracted = String(a.content.toString('utf8'));
                                    } catch (te) {
                                      console.error('[smtp-handler] text attachment read error:', te && te.message ? te.message : te);
                                    }
                                  }

                                  if (extracted && extracted.length > 10) {
                                    try {
                                      // Create a minimal email-like object for KB ingestion
                                      const kbEmail = {
                                        id: `${uid || parsed.messageId || Date.now()}-att-${safeName}`,
                                        from: parsed.from?.text || '',
                                        subject: parsed.subject || `Attachment: ${name}`,
                                        date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
                                        body: extracted
                                      };
                                      // Add to KB
                                      await kbManager.addEmails([kbEmail]);
                                      // Also create embeddings for the extracted text (chunked)
                                      try {
                                        const helperPath = path.join(process.cwd(), 'src', 'backend', 'embeddings-helper.js');
                                        const { pathToFileURL } = await import('url');
                                        const helperUrl = pathToFileURL(helperPath).href;
                                        const { createAndStoreEmbeddingsForLongText } = await import(helperUrl);
                                        await createAndStoreEmbeddingsForLongText(extracted, { filename: name, sourceId: uid || parsed.messageId || null, maxTokens: 2000 });
                                      } catch (embErr) {
                                        console.error('[smtp-handler] embedding helper error:', embErr && embErr.message ? embErr.message : embErr);
                                      }
                                    } catch (ke) {
                                      console.error('[smtp-handler] kbManager.addEmails error:', ke && ke.message ? ke.message : ke);
                                    }
                                  }
                                } finally {
                                  // remove file to avoid leaving local temp files
                                  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (delErr) { console.error('[smtp-handler] failed to delete attachment file:', delErr && delErr.message ? delErr.message : delErr); }
                                }
                              })();
                              // push this processing promise so the mailbox wait will include it
                              parsePromises.push(proc);
                            } catch (procErr) {
                              console.error('[smtp-handler] scheduling attachment processing failed:', procErr && procErr.message ? procErr.message : procErr);
                            }
                          } catch (ea) {
                            console.error('Attachment save error (recent):', ea && ea.message ? ea.message : ea);
                          }
                        }
                      }
                    } catch (eatt) {
                      console.error('Error processing parsed.attachments (recent):', eatt && eatt.message ? eatt.message : eatt);
                    }

                    // Képek kinyerése és AI feldolgozása (hasonlóan a Gmail-hez)
                    const images = [];
                    const aiImageResponses = [];
                    try {
                      if (Array.isArray(parsed.attachments)) {
                        for (const att of parsed.attachments) {
                          const mt = (att.contentType || '').toLowerCase();
                          if (mt.startsWith('image/')) {
                            try {
                              const base64Data = Buffer.from(att.content).toString('base64');
                              const fullBase64 = `data:${att.contentType};base64,${base64Data}`;
                              images.push({
                                mimeType: att.contentType,
                                data: base64Data,
                                base64: fullBase64
                              });
                              
                              // AI képleírás - használjuk a local-ai-helper-t
                              try {
                                const desc = await describeImage(fullBase64, 'Mit látsz ezen a képen?');
                                aiImageResponses.push({
                                  choices: [{ message: { content: desc } }]
                                });
                                console.log(`[smtp-handler] Kép feldolgozva: ${att.filename || 'ismeretlen'}`);
                              } catch (aiErr) {
                                console.error('[smtp-handler] AI képleírás hiba:', aiErr?.message || aiErr);
                                aiImageResponses.push({ error: true, details: aiErr?.message || 'AI hiba' });
                              }
                            } catch (imgErr) {
                              console.error('[smtp-handler] Kép feldolgozási hiba:', imgErr?.message || imgErr);
                            }
                          }
                        }
                      }
                    } catch (imgProcErr) {
                      console.error('[smtp-handler] Képfeldolgozás hiba:', imgProcErr?.message || imgProcErr);
                    }

                    // Inline képek kinyerése HTML-ből is
                    try {
                      const inlineImages = extractInlineImagesFromHtml(parsed.html);
                      for (const img of inlineImages) {
                        if (!images.find(i => i.data === img.data)) {
                          images.push(img);
                          try {
                            const desc = await describeImage(img.base64, 'Mit látsz ezen a képen?');
                            aiImageResponses.push({
                              choices: [{ message: { content: desc } }]
                            });
                          } catch (aiErr) {
                            aiImageResponses.push({ error: true, details: aiErr?.message || 'AI hiba' });
                          }
                        }
                      }
                    } catch (inlineErr) {
                      console.error('[smtp-handler] Inline kép feldolgozási hiba:', inlineErr?.message || inlineErr);
                    }

                    // RFC2047 dekódolás és body kinyerés
                    const decodedSubject = decodeRFC2047(parsed.subject || '');
                    const body = extractBodyFromParsed(parsed);

                    emails.push({
                      id: uid,
                      from: parsed.from?.text || '',
                      subject: decodedSubject,
                      date: parsed.date ? parsed.date.toISOString() : '',
                      body: body,
                      html: parsed.html || null,
                      text: parsed.text || '',
                      // Return the full text as snippet (no truncation)
                      snippet: body,
                      attachments: attachmentsArr,
                      images: images,
                      aiImageResponses: aiImageResponses
                    });
                })().catch(e => console.error('Mail parse hiba (recent):', e));
                parsePromises.push(p);
              });
            });

            f.once('error', err => reject(err));
            f.once('end', async () => {
              try {
                await Promise.all(parsePromises);
                // Filter by settings.fromDate (keep emails from that date up to now)
                try {
                  const settingsPath = path.resolve(process.cwd(), 'settings.json');
                  const raw = fs.readFileSync(settingsPath, 'utf8');
                  const settings = JSON.parse(raw);
                  const fromDateStr = settings?.fromDate;
                  if (fromDateStr && /^\d{4}-\d{2}-\d{2}$/.test(fromDateStr)) {
                    const [y, m, d] = fromDateStr.split('-');
                    const startDate = new Date(Number(y), Number(m) - 1, Number(d));
                    startDate.setHours(0,0,0,0);
                    const filtered = emails.filter(e => {
                      try {
                        const ed = e.date ? new Date(e.date) : null;
                        return ed && !isNaN(ed) && ed >= startDate;
                      } catch (ex) { return false; }
                    });
                    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                    resolve(filtered);
                    return;
                  }
                } catch (pfErr) {
                  console.error('[AIServiceApp][smtp-handler.js] settings.json read error (post-filter):', pfErr.message);
                }

                emails.sort((a, b) => new Date(b.date) - new Date(a.date));
                resolve(emails);
              } catch (e) {
                reject(e);
              }
            });
          });
        };

        if (this.imap.state === 'authenticated' || this.imap.state === 'selected' || this.imap.state === 'connected') {
          openInbox(processMailbox);
        } else {
          this.imap.once('ready', () => openInbox(processMailbox));
          this.imap.once('error', reject);
          this.imap.connect();
        }
      } catch (err) {
        return reject(err);
      }
    });
  }

  async sendEmail({ to, subject, body, html, attachments }) {
    try {
      console.log('SMTP sendMail params:', { from: this.config.email, to, subject });
      await this.transporter.sendMail({
        from: this.config.email,
        to,
        subject,
        text: body,
        html: html,
        attachments: attachments,
        encoding: 'utf-8',
        textEncoding: 'base64' // <-- KÉNYSZERÍTSD BASE64-RE!
      });
      return { success: true };
    } catch (error) {
      console.error('Email küldési hiba:', error);
      return { success: false, error: error.message };
    }
  }

  async markAsRead(messageId) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.imap) {
          return reject(new Error('IMAP connection is not established.'));
        }
        const markRead = () => {
          this.imap.openBox('INBOX', false, (err) => {
            if (err) {
              reject(err);
              return;
            }

            this.imap.addFlags(messageId, ['\\Seen'], (err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        };

        if (this.imap.state === 'connected') {
          markRead();
        } else {
          this.imap.once('ready', markRead);
          this.imap.once('error', reject);
          this.imap.connect();
        }
      } catch (err) {
        if (err instanceof TypeError) {
          console.error('TypeError (ignored) in markAsRead:', err.message);
          return reject(err);
        } else {
          console.error('Error in markAsRead:', err);
          return reject(err);
        }
      }
    });
  }

  async getEmailById(id) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.imap) return reject(new Error('IMAP connection is not established.'));
        const fetchEmail = () => {
          this.imap.openBox('INBOX', false, (err) => {
            if (err) return reject(err);

            const f = this.imap.fetch(id, {
              bodies: '',   // FULL RAW
              struct: true,
              uid: true
            });

            f.on('message', (msg) => {
              let raw = '';
              let uid = id;

              msg.on('attributes', attrs => {
                uid = attrs.uid;
              });

              msg.on('body', (stream) => {
                stream.on('data', chunk => raw += chunk.toString('utf8'));
              });

              msg.once('end', async () => {
                try {
                  const parsed = await simpleParser(raw);
                    // Save any attachments to disk and include metadata
                    const attachmentsArr = [];
                    try {
                      if (Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
                        const attsDir = path.resolve(process.cwd(), 'fromAttachments');
                        if (!fs.existsSync(attsDir)) fs.mkdirSync(attsDir, { recursive: true });
                        for (const a of parsed.attachments) {
                          try {
                            const name = a.filename || `att-${uid || id}-${Date.now()}`;
                            const safeName = `${uid || id}-${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                            const filePath = path.join(attsDir, safeName);
                            fs.writeFileSync(filePath, a.content);
                            const b64 = Buffer.from(a.content).toString('base64');
                            attachmentsArr.push({ filename: name, mimeType: a.contentType || 'application/octet-stream', path: filePath, base64: b64 });
                          } catch (ea) {
                            console.error('Attachment save error (getEmailById):', ea && ea.message ? ea.message : ea);
                          }
                        }
                      }
                    } catch (eatt) {
                      console.error('Error processing parsed.attachments (getEmailById):', eatt && eatt.message ? eatt.message : eatt);
                    }

                    // Képek kinyerése és AI feldolgozása (hasonlóan a Gmail-hez)
                    const images = [];
                    const aiImageResponses = [];
                    try {
                      if (Array.isArray(parsed.attachments)) {
                        for (const att of parsed.attachments) {
                          const mt = (att.contentType || '').toLowerCase();
                          if (mt.startsWith('image/')) {
                            try {
                              const base64Data = Buffer.from(att.content).toString('base64');
                              const fullBase64 = `data:${att.contentType};base64,${base64Data}`;
                              images.push({
                                mimeType: att.contentType,
                                data: base64Data,
                                base64: fullBase64
                              });
                              
                              // AI képleírás - használjuk a local-ai-helper-t
                              try {
                                const desc = await describeImage(fullBase64, 'Mit látsz ezen a képen?');
                                aiImageResponses.push({
                                  choices: [{ message: { content: desc } }]
                                });
                                console.log(`[smtp-handler] Kép feldolgozva (getEmailById): ${att.filename || 'ismeretlen'}`);
                              } catch (aiErr) {
                                console.error('[smtp-handler] AI képleírás hiba (getEmailById):', aiErr?.message || aiErr);
                                aiImageResponses.push({ error: true, details: aiErr?.message || 'AI hiba' });
                              }
                            } catch (imgErr) {
                              console.error('[smtp-handler] Kép feldolgozási hiba (getEmailById):', imgErr?.message || imgErr);
                            }
                          }
                        }
                      }
                    } catch (imgProcErr) {
                      console.error('[smtp-handler] Képfeldolgozás hiba (getEmailById):', imgProcErr?.message || imgProcErr);
                    }

                    // Inline képek kinyerése HTML-ből
                    try {
                      const inlineImages = extractInlineImagesFromHtml(parsed.html);
                      for (const img of inlineImages) {
                        if (!images.find(i => i.data === img.data)) {
                          images.push(img);
                          try {
                            const desc = await describeImage(img.base64, 'Mit látsz ezen a képen?');
                            aiImageResponses.push({
                              choices: [{ message: { content: desc } }]
                            });
                          } catch (aiErr) {
                            aiImageResponses.push({ error: true, details: aiErr?.message || 'AI hiba' });
                          }
                        }
                      }
                    } catch (inlineErr) {
                      console.error('[smtp-handler] Inline kép feldolgozási hiba (getEmailById):', inlineErr?.message || inlineErr);
                    }

                    // Csatolt dokumentumok feldolgozása és beágyazása (PDF, Excel, Word, EML)
                    const emailMeta = {
                      from: parsed.from?.text || '',
                      subject: parsed.subject || '',
                      date: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                    };
                    for (const att of attachmentsArr) {
                      const lower = (att.filename || '').toLowerCase();
                      const mt = (att.mimeType || '').toLowerCase();
                      if (lower.endsWith('.pdf') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || 
                          lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.eml') ||
                          mt.includes('pdf') || mt.includes('spreadsheet') || mt.includes('word') || mt.includes('message/rfc822')) {
                        try {
                          const content = fs.readFileSync(att.path);
                          await processAndEmbedAttachment(content, att.filename, att.mimeType, emailMeta, uid || id);
                          // Töröljük a feldolgozott fájlt
                          try { fs.unlinkSync(att.path); } catch (delErr) { /* ignore */ }
                        } catch (procErr) {
                          console.error('[smtp-handler] Attachment processing error (getEmailById):', procErr?.message || procErr);
                        }
                      }
                    }

                    // RFC2047 dekódolás és body kinyerés
                    const decodedSubject = decodeRFC2047(parsed.subject || '');
                    const body = extractBodyFromParsed(parsed);

                    resolve({
                      id: uid,
                      from: parsed.from?.text || '',
                      subject: decodedSubject,
                      date: parsed.date ? parsed.date.toISOString() : '',
                      body: body,
                      html: parsed.html || null,
                      text: parsed.text || '',
                      raw,
                      attachments: attachmentsArr,
                      images: images,
                      aiImageResponses: aiImageResponses
                    });
                } catch (e) {
                  reject(e);
                }
              });
            });

            f.once('error', err => reject(err));
          });
        };

        if (this.imap.state === 'connected' || this.imap.state === 'authenticated' || this.imap.state === 'selected') {
          fetchEmail();
        } else {
          this.imap.once('ready', fetchEmail);
          this.imap.once('error', reject);
          this.imap.connect();
        }
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default SmtpEmailHandler;