import path from 'path';
import { fileURLToPath } from 'url';
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import fs from 'fs';
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import updaterPkg from "electron-updater";
const { autoUpdater } = updaterPkg;

import { findFile } from './src/utils/findFile.js';
import { getSecret } from './src/utils/keytarHelper.js';
import { getUnreadEmails, getEmailById, getRecentEmails } from './gmail.js';
import KB from './src/backend/kb-manager.js';
import SmtpEmailHandler from './src/backend/smtp-handler.js';
import { authorize } from './src/backend/auth.js';

import {
  createDbConnection,
  setTrialEndedForLicence,
  checkLicenceInDb,
  isLicenceActivated,
  activateLicence,
  updateEmailInUse,
  clearEmailInUse,
  getTrialStatusFromDb,
  decrementRemainingGenerations
} from './src/backend/db-helper.js';

import {
  readConfig,
  saveConfig,
  readRepliedEmails,
  saveRepliedEmails,
  readGeneratedReplies,
  saveGeneratedReplies,
  readCachedEmails,
  saveCachedEmails,
  readSentEmailsLog,
  appendSentEmailLog,
  logToFile,
  formatAddress,
  extractEmailAddress,
  safeTrim,
  CACHED_EMAILS_FILE,
  TOKEN_PATH,
  getConfigFile,
  getAuthStateFile
} from './src/backend/file-helpers.js';

import {
  getSettings,
  saveSettings,
  getSetting,
  setSetting,
  defaultSettings
} from './src/backend/settings-manager.js';

import {
  getAuthState,
  setAuthState,
  loadAuthState,
  setGmailAuth,
  setSmtpAuth,
  logout as logoutAuth,
  isGmailProvider,
  isSmtpProvider,
  isAuthenticated
} from './src/backend/auth-state.js';

import {
  checkInternetConnection,
  startInternetMonitoring,
  stopInternetMonitoring
} from './src/backend/internet-monitor.js';

import {
  readExcelDataWithImages,
  excelExists,
  getExcelPath,
  readExcelFile,
  saveExcelFile,
  uploadExcelFile,
  findExcelCell
} from './src/backend/excel-helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Globális változók
let mainWindow = null;
let smtpHandler = null;
let emailMonitoringInterval = null;
let repliedEmailIds = readRepliedEmails();
let replyInProgressIds = [];
let emailCheckInProgress = false;
let activationEmail = getSetting('activationEmail', null);

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Globális hibakezelő
process.on('uncaughtException', (err) => {
  console.error('Globális uncaughtException (IGNORED):', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Globális unhandledRejection (IGNORED):', reason);
});

// OpenAI inicializálás
const openKey = await getSecret('OpenAPIKey');
if (!openKey) {
  throw new Error('OpenAPIKey nincs beállítva Keytarban!');
}

const openai = new OpenAI({ apiKey: openKey });

// =============================================================================
// EMAIL PROVIDER FUNCTIONS
// =============================================================================

async function getEmailsBasedOnProvider() {
  const authState = getAuthState();
  const settings = getSettings();
  let emails = [];

  if (authState.provider === 'smtp') {
    console.log('Fetching emails using SMTP provider...');
    emails = await smtpHandler.getUnreadEmails();
  } else if (authState.provider === 'gmail') {
    console.log('Fetching emails using Gmail provider...');
    emails = await getUnreadEmails();
  } else {
    console.error('Invalid email provider configured:', authState.provider);
    return [];
  }

  console.log(`Fetched ${emails.length} emails from ${authState.provider} provider.`);

  // Dátum szűrés
  if (settings.minEmailDate || settings.maxEmailDate) {
    const minDate = settings.minEmailDate ? new Date(settings.minEmailDate) : null;
    if (minDate) minDate.setHours(0, 0, 0, 0);
    const maxDate = settings.maxEmailDate ? new Date(settings.maxEmailDate) : null;
    if (maxDate) maxDate.setHours(23, 59, 59, 999);
    emails = emails.filter(email => {
      let emailDate = null;
      if (email.internalDate) {
        emailDate = new Date(Number(email.internalDate));
      } else if (email.date) {
        emailDate = new Date(email.date);
        if (isNaN(emailDate)) {
          const parts = email.date.match(/(\d{4})[.\-\/ ]+(\d{2})[.\-\/ ]+(\d{2})/);
          if (parts) {
            emailDate = new Date(`${parts[1]}-${parts[2]}-${parts[3]}`);
          }
        }
      }
      if (!emailDate || isNaN(emailDate)) return false;
      if (minDate && emailDate < minDate) return false;
      if (maxDate && emailDate > maxDate) return false;
      return true;
    });
  }

  return emails;
}

async function getEmailByIdBasedOnProvider(id) {
  const authState = getAuthState();
  if (authState.provider === 'smtp') {
    if (!smtpHandler || !smtpHandler.imap) {
      throw new Error('SMTP/IMAP connection is not established.');
    }
    return await smtpHandler.getEmailById(id);
  } else if (authState.provider === 'gmail') {
    return await getEmailById(id);
  } else {
    throw new Error('No valid email provider configured');
  }
}

// =============================================================================
// EMAIL MONITORING
// =============================================================================

function startEmailMonitoring() {
  if (emailMonitoringInterval) {
    clearInterval(emailMonitoringInterval);
  }
  // Changed from 5000ms to 30000ms (30 seconds) to reduce IMAP load
  // The SMTP handler now has internal caching and throttling as well
  emailMonitoringInterval = setInterval(async () => {
    try {
      await checkEmailsOnce();
    } catch (err) {
      console.error('Error in scheduled email check:', err);
    }
  }, 30000);
}

function stopEmailMonitoring() {
  if (emailMonitoringInterval) {
    clearInterval(emailMonitoringInterval);
    emailMonitoringInterval = null;
  }
}

async function checkEmailsOnce() {
  if (emailCheckInProgress) return;
  emailCheckInProgress = true;
  
  try {
    const settings = getSettings();
    const hasInternet = await checkInternetConnection();
    
    if (!hasInternet) {
      console.log('No internet connection, skipping email check.');
      BrowserWindow.getAllWindows().forEach(window => window.webContents.send('no-internet-connection'));
      return;
    } else {
      BrowserWindow.getAllWindows().forEach(window => window.webContents.send('internet-connection-restored'));
    }

    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    console.log('Checking emails at:', currentTimeString);

    // SPAM + IGNORED szűrés
    const spamKeywords = ['hirlevel', 'no-reply','noreply','no reply','spam', 'junk', 'promóció', 'reklám', 'ad', 'free money', "guaranteed", "amazing deal", "act now", "limited time", "click here", "buy now"];
    let unreadEmails = await getEmailsBasedOnProvider();
    const ignoredEmailsList = (settings.ignoredEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean);
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const spamRegexes = spamKeywords.map(k => new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i'));

    const beforeCount = unreadEmails.length;
    unreadEmails = unreadEmails.filter(email => {
      const subject = (email.subject || '').toLowerCase();
      const from = (email.from || '').toLowerCase();

      if (email.labelIds && Array.isArray(email.labelIds) && email.labelIds.includes('SPAM')) {
        return false;
      }
      const matchedSpam = spamRegexes.find(rx => rx.test(email.subject || '') || rx.test(email.from || ''));
      if (matchedSpam) {
        return false;
      }
      const matchedIgnored = ignoredEmailsList.find(ignored => from.includes(ignored));
      if (matchedIgnored) {
        return false;
      }
      return true;
    });

    console.log('Fetched emails (spam+ignored szűrve):', unreadEmails.length, `(before: ${beforeCount})`);

    try { saveCachedEmails(unreadEmails); } catch (err) { console.error('Failed to save cached emails:', err); }
    BrowserWindow.getAllWindows().forEach(window => window.webContents.send('emails-updated', unreadEmails));

    // Auto reply kezelés
    if (settings.autoSend && currentTimeString >= settings.autoSendStartTime && currentTimeString <= settings.autoSendEndTime && unreadEmails && unreadEmails.length > 0) {
      console.log(`Processing ${unreadEmails.length} emails for auto-reply`);
      for (const email of unreadEmails) {
        await processEmailForAutoReply(email);
      }
    }
  } finally {
    emailCheckInProgress = false;
  }
}

async function processEmailForAutoReply(email) {
  const authState = getAuthState();
  
  try {
    const subjectLower = (email.subject || '').toLowerCase();
    const fromLower = (email.from || '').toLowerCase();
    if (subjectLower.includes('noreply') || fromLower.includes('noreply') || 
        subjectLower.includes('no reply') || fromLower.includes('no reply') || 
        subjectLower.includes('no-reply') || fromLower.includes('no-reply')) {
      console.log('Skipping noreply email:', email.id);
      return;
    }
    
    if (!repliedEmailIds.includes(email.id) && !replyInProgressIds.includes(email.id)) {
      replyInProgressIds.push(email.id);
      console.log('Processing email for reply:', email.id, email.subject);
      
      let fullEmail;
      try { 
        fullEmail = await getEmailByIdBasedOnProvider(email.id); 
      } catch (err) {
        console.error('getEmailById error:', err);
        replyInProgressIds = replyInProgressIds.filter(id => id !== email.id);
        return;
      }
      
      let generatedReply;
      try { 
        generatedReply = await generateReply(fullEmail); 
      } catch (err) { 
        console.error('generateReply error:', err); 
        replyInProgressIds = replyInProgressIds.filter(id => id !== email.id); 
        return; 
      }
      
      let replyResult;
      try {
        if (authState.provider === 'smtp' && smtpHandler) {
          const toAddress = extractEmailAddress(fullEmail.from);
          if (!toAddress) { 
            console.error('Nem sikerült email címet kinyerni:', fullEmail.from); 
            replyInProgressIds = replyInProgressIds.filter(id => id !== email.id); 
            return; 
          }
          replyResult = await sendReply({ 
            to: toAddress, 
            subject: fullEmail.subject, 
            body: generatedReply, 
            emailId: fullEmail.id, 
            originalEmail: { to: fullEmail.from || 'Ismeretlen feladó', subject: fullEmail.subject, body: fullEmail.body } 
          });
        } else if (authState.provider === 'gmail') {
          replyResult = await sendReply({ 
            to: fullEmail.from, 
            subject: fullEmail.subject, 
            body: generatedReply, 
            emailId: fullEmail.id, 
            originalEmail: { to: fullEmail.from || 'Ismeretlen feladó', subject: fullEmail.subject, body: fullEmail.body } 
          });
        }
      } catch (err) { 
        console.error('sendReply error:', err); 
        replyInProgressIds = replyInProgressIds.filter(id => id !== email.id); 
        return; 
      }

      if ((replyResult && replyResult.success) || (replyResult && replyResult.id)) {
        let markedAsRead = false;
        try {
          if (authState.provider === 'smtp' && smtpHandler) {
            await smtpHandler.markAsRead(email.id);
            markedAsRead = true;
          } else if (authState.provider === 'gmail') {
            const auth = await authorize();
            const gmail = google.gmail({ version: 'v1', auth });
            await gmail.users.messages.modify({ userId: 'me', id: email.id, requestBody: { removeLabelIds: ['UNREAD'] } });
            markedAsRead = true;
          }
        } catch (err) { console.error('Error marking email as read:', err); }

        if (markedAsRead) {
          repliedEmailIds.push(email.id);
          saveRepliedEmails(repliedEmailIds);
          try { removeEmailFromCache(email.id); } catch (err) { console.error('Failed to remove email from cache:', err); }
          console.log('Reply sent and email marked as read for:', email.id);
        }
      }
      replyInProgressIds = replyInProgressIds.filter(id => id !== email.id);
    }
  } catch (err) { 
    console.error('Error processing email for auto-reply:', err); 
  }
}

function removeEmailFromCache(emailId) {
  try {
    const emails = readCachedEmails();
    const filtered = emails.filter(e => e.id !== emailId);
    saveCachedEmails(filtered);
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('emails-updated', filtered);
    });
  } catch (err) {
    console.error('Hiba a cached_emails.json frissítésekor:', err);
  }
}

// =============================================================================
// DEMO/TRIAL FUNCTIONS
// =============================================================================

async function isDemoOver(licence = null) {
  try {
    try {
      if (licence) {
        const trialStatus = await getTrialStatusFromDb(licence);
        if (trialStatus) {
          let dbSaysOver = false;
          if (typeof trialStatus.remainingGenerations !== 'undefined' && trialStatus.remainingGenerations !== null) {
            const remaining = Number(trialStatus.remainingGenerations);
            if (!Number.isNaN(remaining) && remaining <= 0) {
              dbSaysOver = true;
            }
          }
          if (!dbSaysOver && trialStatus.trialEndDate) {
            const normalized = trialStatus.trialEndDate.replace(' ', 'T');
            const trialDate = new Date(normalized);
            if (!isNaN(trialDate.getTime())) {
              const now = new Date();
              if (trialDate <= now) {
                dbSaysOver = true;
              }
            }
          }
          if (dbSaysOver) return true;
        }
      }
    } catch (dbErr) {
      console.error('[isDemoOver] DB check failed:', dbErr);
    }

    const log = readSentEmailsLog();
    return Array.isArray(log) && log.length >= 100;
  } catch (e) {
    console.error('[isDemoOver] Unexpected error:', e);
    return false;
  }
}

// =============================================================================
// AI FUNCTIONS
// =============================================================================

async function safeCreateEmbedding(model, text) {
  if (!text) return null;
  const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    const resp = await openai.embeddings.create({ model, input: String(text) });
    return resp?.data?.[0]?.embedding || null;
  } catch (err) {
    console.error('[safeCreateEmbedding] full text embed failed:', err?.message || err);
    try {
      const SUB_CHUNK = 2000;
      const parts = [];
      for (let i = 0; i < String(text).length; i += SUB_CHUNK) parts.push(String(text).slice(i, i + SUB_CHUNK));
      if (!parts.length) return null;
      const embeddings = [];
      for (let i = 0; i < parts.length; i += 20) {
        const batch = parts.slice(i, i + 20);
        try {
          const r = await openai.embeddings.create({ model, input: batch });
          const data = (r && r.data) ? r.data.map(d => d.embedding) : [];
          for (const v of data) embeddings.push(v);
        } catch (be) {
          console.error('[safeCreateEmbedding] sub-batch embed failed:', be?.message || be);
          for (const part of batch) {
            try {
              const rr = await openai.embeddings.create({ model, input: part });
              const dv = rr?.data?.[0]?.embedding;
              if (dv) embeddings.push(dv);
            } catch (e2) {
              console.error('[safeCreateEmbedding] single subchunk embed failed:', e2?.message || e2);
            }
            await SLEEP(100);
          }
        }
        await SLEEP(100);
      }
      if (!embeddings.length) return null;
      const len = embeddings.length;
      const out = new Array(embeddings[0].length).fill(0);
      for (const vec of embeddings) {
        for (let k = 0; k < vec.length; k++) out[k] += vec[k] || 0;
      }
      for (let k = 0; k < out.length; k++) out[k] = out[k] / len;
      return out;
    } catch (ex) {
      console.error('[safeCreateEmbedding] failed via subchunks:', ex?.message || ex);
      return null;
    }
  }
}

async function describeImagesWithAI(images) {
  if (!images || images.length === 0) return [];
  const descriptions = [];
  for (const img of images) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Írj rövid, informatív leírást erről a képről magyarul!" },
              { type: "image_url", image_url: { url: img.base64 } }
            ]
          }
        ],
        max_tokens: 200
      });
      const desc = completion.choices[0]?.message?.content || '(nincs leírás)';
      descriptions.push(desc);
    } catch (err) {
      console.error('AI képleírás hiba:', err);
      descriptions.push('(AI leírás sikertelen)');
    }
  }
  return descriptions;
}

// Prompt alap
const promptBase = `Egy ügyféltől a következő email érkezett:\n\n{greeting}\n\n"{email.body}"\n\n{imageDescriptions}\n\n{excelImageDescriptions}\n\nA következő adatokat használd fel a válaszadáshoz:\n{excelData}\n\n{signature}\n\n{webUrls}\n{embeddingsContext}\nEzekről a htmlek-ről is gyűjtsd ki a szükséges információkat a válaszadáshoz: {webUrls}, gyűjts ki a szükséges információkat, linkeket, telefonszámokat, email címeket és így tovább és ezeket küldd vissza.\n\n`;

async function generateReply(email) {
  const settings = getSettings();
  const authState = getAuthState();
  
  try {
    // Teljes email lekérése
    try {
      if (email && email.id) {
        try {
          const full = await getEmailByIdBasedOnProvider(email.id);
          if (full) {
            if (full.body) email.body = full.body;
            if (full.aiImageResponses) email.aiImageResponses = full.aiImageResponses;
            if (full.subject) email.subject = full.subject;
            if (full.from) email.from = full.from;
          }
        } catch (e) {
          console.warn('[generateReply] could not fetch full email by id:', e);
        }
      }
    } catch (e) {
      console.warn('[generateReply] pre-fetch full email guard failed', e);
    }

    // RemainingGenerations csökkentése
    try {
      let userEmail = null;
      if (activationEmail) {
        userEmail = activationEmail;
      } else if (authState.credentials && authState.credentials.email) {
        userEmail = authState.credentials.email;
      } else if (smtpHandler && smtpHandler.config && smtpHandler.config.email) {
        userEmail = smtpHandler.config.email;
      }
      if (userEmail) {
        await decrementRemainingGenerations(userEmail);
      }
    } catch (err) {
      console.error('[generateReply] Error decrementing remainingGenerations:', err);
    }

    // Web URL-ek lekérése
    let htmlContents = [];
    if (settings.webUrls && Array.isArray(settings.webUrls)) {
      for (const url of settings.webUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const html = await response.text();
            htmlContents.push(html);
          }
        } catch (error) {
          console.error(`Error fetching web URL (${url}):`, error);
        }
      }
    }
    const combinedHtml = htmlContents.join('\n\n');

    // Excel adatok
    const { allData: excelData, allImages: excelImages } = await readExcelDataWithImages();
    const formattedExcelData = Object.entries(excelData)
      .map(([sheetName, rows]) => {
        const rowsText = rows.map((row, index) => {
          if (typeof row === 'object' && !Array.isArray(row)) {
            return `   ${index + 1}. ${Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(', ')}`;
          } else if (Array.isArray(row)) {
            return `   ${index + 1}. ${row.join(', ')}`;
          } else {
            return `   ${index + 1}. ${row}`;
          }
        }).join('\n');
        return `Munkalap: ${sheetName}\n${rowsText}`;
      })
      .join('\n\n');

    // Excel képek leírása
    let excelImageDescriptions = '';
    if (excelImages && excelImages.length > 0) {
      const aiDescs = await describeImagesWithAI(excelImages);
      excelImageDescriptions = '\nAz Excelből származó képek AI által generált leírásai:';
      excelImageDescriptions += aiDescs.map((desc, idx) => `\n${idx + 1}. ${desc}`).join('');
      excelImageDescriptions += '\n';
    }

    const greeting = settings.greeting || defaultSettings.greeting;
    const signature = settings.signature || defaultSettings.signature;

    // Email képleírások
    let imageDescriptions = '';
    if (email.aiImageResponses && email.aiImageResponses.length > 0) {
      imageDescriptions = '\nA levélhez csatolt képek AI által generált leírásai:';
      imageDescriptions += email.aiImageResponses.map((resp, idx) => {
        let desc = '';
        if (resp && resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content) {
          desc = resp.choices[0].message.content;
        } else {
          desc = JSON.stringify(resp);
        }
        return `\n${idx + 1}. ${desc}`;
      }).join('');
      imageDescriptions += '\n';
    }

    // Safety limits
    const SAFE_HTML_MAX_CHARS = 100000;
    const SAFE_EXCEL_MAX_CHARS = 40000;
    const SAFE_IMAGE_DESC_MAX_CHARS = 3000;

    const safeCombinedHtml = safeTrim(combinedHtml || '', SAFE_HTML_MAX_CHARS);
    const safeFormattedExcelData = safeTrim(formattedExcelData || '', SAFE_EXCEL_MAX_CHARS);
    const safeImageDescriptions = safeTrim(imageDescriptions || '', SAFE_IMAGE_DESC_MAX_CHARS);
    const safeExcelImageDescriptions = safeTrim(excelImageDescriptions || '', SAFE_IMAGE_DESC_MAX_CHARS);

    // Embeddings context (simplified version)
    let embeddingsContext = '';
    try {
      // Excel cell lookup detection
      const searchText = `${email.subject || ''}\n${email.body || ''}`;
      const direct = String(searchText).match(/([^!\n\r]+)[!\s]+([A-Za-z]+)\s*-?\s*(\d{1,6})/);
      if (direct) {
        const detected = { sheet: direct[1].trim(), colLetter: direct[2].trim().toUpperCase(), row: Number(direct[3]) };
        try {
          const lookupRes = await findExcelCell(detected);
          if (lookupRes && lookupRes.success && lookupRes.text) {
            const short = String(lookupRes.text).slice(0, 2000);
            const cellAddr = `${detected.sheet || ''}!${detected.colLetter || ''}${detected.row || ''}`;
            embeddingsContext += `EXACT_CELL_LOOKUP: ${cellAddr} => ${short}\n\n`;
          }
        } catch (e) {
          // ignore lookup failures
        }
      }
    } catch (e) {
      // non-fatal
    }

    // Prompt összeállítása
    const finalPrompt = promptBase
      .replace('{greeting}', greeting)
      .replace('{signature}', signature)
      .replace('{email.body}', email.body || '')
      .replace('{excelData}', safeFormattedExcelData)
      .replace('{imageDescriptions}', safeImageDescriptions)
      .replace('{excelImageDescriptions}', safeExcelImageDescriptions)
      .replace('{webUrls}', safeCombinedHtml || 'N/A')
      .replace('{embeddingsContext}', embeddingsContext || '');

    // AI hívás
    const systemPrompt = "Te egy segítőkész asszisztens vagy, aki udvarias és professzionális válaszokat ír az ügyfeleknek. Az Excel adatokat és a megadott html-ről szerzett információkat használd fel a válaszadáshoz, ha releváns információt találsz bennük. Elsődlegesen a levél tartalma alapján válaszolj.";

    let messageContent = null;

    // Ollama próba
    try {
      console.log('[generateReply] Trying Ollama local server...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const promptForOllama = `${systemPrompt}\n\n${finalPrompt}`;

      const localResp = await fetch('http://192.168.88.12:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1:8b',
          prompt: promptForOllama,
          temperature: 1,
          stream: false
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (localResp && localResp.ok) {
        const localData = await localResp.json();
        if (typeof localData?.response === 'string') {
          messageContent = localData.response;
          console.log('[generateReply] Local Ollama responded.');
        }
      }
    } catch (localErr) {
      console.warn('[generateReply] Local Ollama unavailable:', localErr?.message || localErr);
    }

    // OpenAI fallback
    if (!messageContent) {
      try {
        console.log('[generateReply] Sending prompt to OpenAI...');
        const completion = await openai.chat.completions.create({
          model: 'gpt-5-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: finalPrompt }],
          temperature: 1
        });
        messageContent = completion?.choices?.[0]?.message?.content;
      } catch (err) {
        console.error('[generateReply] OpenAI completion error:', err);
      }
    }

    if (!messageContent || String(messageContent).trim().length === 0) {
      return 'Sajnálom, nem sikerült érdemi választ generálni a megadott adatok alapján.';
    }
    return messageContent;
  } catch (error) {
    console.error('Hiba a válasz generálásakor:', error);
    throw error;
  }
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

async function sendReply({ to, subject, body, emailId, originalEmail }) {
  const authState = getAuthState();
  const settings = getSettings();
  
  try {
    console.log(`[sendReply] Küldés: to=${to}, subject=${subject}`);

    let sendResult;
    const signatureText = settings.signatureText || 'AiMail';
    const signatureImage = settings.signatureImage || '';
    const watermarkImagePath = path.join(__dirname, 'src', 'images', 'watermark.png');
    let imageCid = 'signature';
    let watermarkCid = 'watermark';
    let htmlBody = body.replace(/\n/g, '<br>');

    if (signatureText) htmlBody += `<br><br>${signatureText}`;
    if (signatureImage && fs.existsSync(signatureImage)) {
      htmlBody += `<br><img src="cid:${imageCid}" style="width:25%">`;
    }
    if (fs.existsSync(watermarkImagePath)) {
      htmlBody += `<br><img src="cid:${watermarkCid}" style="width:25%">`;
    }

    if (originalEmail) {
      htmlBody += `<br><br>--- Eredeti üzenet ---`;
      htmlBody += `<br><br><strong>Feladó:</strong> ${originalEmail.to}`;
      htmlBody += `<br><strong>Tárgy:</strong> ${originalEmail.subject}`;
      htmlBody += `<br><br><strong>Üzenet:</strong><br>${originalEmail.body.replace(/\n/g, '<br>')}`;
    }

    // Csatolmányok
    const attachmentsDir = path.join(app.getPath('userData'), 'attachments');
    let attachmentFiles = [];
    if (fs.existsSync(attachmentsDir)) {
      attachmentFiles = fs.readdirSync(attachmentsDir).filter(f => fs.statSync(path.join(attachmentsDir, f)).isFile());
    }
    const nodemailerAttachments = attachmentFiles.map(filename => ({
      filename,
      path: path.join(attachmentsDir, filename)
    }));

    if (signatureImage && fs.existsSync(signatureImage)) {
      nodemailerAttachments.push({
        filename: path.basename(signatureImage),
        path: signatureImage,
        cid: imageCid
      });
    }
    if (fs.existsSync(watermarkImagePath)) {
      nodemailerAttachments.push({
        filename: path.basename(watermarkImagePath),
        path: watermarkImagePath,
        cid: watermarkCid
      });
    }

    // MIME message
    let boundary = '----=_Part_' + Math.random().toString(36).slice(2);
    let mimeMsg = '';
    let encodedSubject = `=?UTF-8?B?${Buffer.from(subject || 'Válasz', 'utf-8').toString('base64')}?=`;
    mimeMsg += `To: ${formatAddress(to)}\r\n`;
    mimeMsg += `Subject: ${encodedSubject}\r\n`;
    mimeMsg += `MIME-Version: 1.0\r\n`;
    mimeMsg += `Content-Type: multipart/related; boundary="${boundary}"\r\n`;

    mimeMsg += `\r\n--${boundary}\r\n`;
    mimeMsg += `Content-Type: text/html; charset="UTF-8"\r\n`;
    mimeMsg += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    mimeMsg += `<html><body>${htmlBody}</body></html>\r\n`;

    for (const attachment of nodemailerAttachments) {
      const fileData = fs.readFileSync(attachment.path);
      const mimeType = attachment.cid ? 'image/png' : 'application/octet-stream';
      mimeMsg += `\r\n--${boundary}\r\n`;
      mimeMsg += `Content-Type: ${mimeType}\r\n`;
      mimeMsg += `Content-Transfer-Encoding: base64\r\n`;
      mimeMsg += `Content-Disposition: ${attachment.cid ? 'inline' : 'attachment'}; filename="${attachment.filename}"\r\n`;
      if (attachment.cid) mimeMsg += `Content-ID: <${attachment.cid}>\r\n`;
      mimeMsg += `\r\n${fileData.toString('base64').replace(/(.{76})/g, '$1\r\n')}\r\n`;
    }

    mimeMsg += `--${boundary}--`;

    const encodedMessage = Buffer.from(mimeMsg)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    if (authState.provider === 'smtp') {
      await smtpHandler.connect();
      const mailOptions = {
        to,
        subject,
        body: htmlBody,
        html: htmlBody,
        attachments: nodemailerAttachments,
      };
      const result = await smtpHandler.sendEmail(mailOptions);
      if (result.success) {
        sendResult = { success: true };
        console.log(`[sendReply] SMTP küldés sikeres.`);
      } else {
        throw new Error(result.error || 'SMTP küldési hiba.');
      }
    } else if (authState.provider === 'gmail') {
      const auth = await authorize();
      const gmail = google.gmail({ version: 'v1', auth });
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
      sendResult = { success: true };
      console.log(`[sendReply] Gmail küldés sikeres.`);
    }

    // Log sent email
    appendSentEmailLog({
      id: emailId || null,
      to,
      subject,
      date: new Date().toISOString(),
      body: body,
      signatureText: signatureText,
      signatureImage: signatureImage,
    });

    return sendResult;
  } catch (error) {
    console.error(`[sendReply] Hiba: ${error.message}`);
    throw error;
  }
}

// =============================================================================
// IPC HANDLERS
// =============================================================================

// Attachment handlers
ipcMain.handle('upload-attachment', async (event, { name, size, content }) => {
  try {
    if (!name || !content) return { success: false, error: 'Hiányzó fájlnév vagy tartalom.' };
    if (size > 25 * 1024 * 1024) return { success: false, error: 'A fájl mérete nem lehet nagyobb 25 MB-nál.' };
    
    const attachmentsDir = path.join(app.getPath('userData'), 'attachments');
    if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });
    
    let base = path.parse(name).name;
    let ext = path.parse(name).ext;
    let filePath = path.join(attachmentsDir, name);
    let counter = 1;
    while (fs.existsSync(filePath)) {
      filePath = path.join(attachmentsDir, `${base}(${counter})${ext}`);
      counter++;
    }
    fs.writeFileSync(filePath, Buffer.from(content));
    return { success: true, filePath };
  } catch (error) {
    console.error('[upload-attachment] Hiba:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-attachment', async (event, { name }) => {
  try {
    if (!name) return { success: false, error: 'Hiányzó fájlnév.' };
    const attachmentsDir = path.join(app.getPath('userData'), 'attachments');
    const filePath = path.join(attachmentsDir, name);
    if (!fs.existsSync(filePath)) return { success: false, error: 'A fájl nem található.' };
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    console.error('Hiba a csatolmány törlésekor:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-attachments', async () => {
  try {
    const attachmentsDir = path.join(app.getPath('userData'), 'attachments');
    if (!fs.existsSync(attachmentsDir)) return [];
    return fs.readdirSync(attachmentsDir).filter(f => fs.statSync(path.join(attachmentsDir, f)).isFile());
  } catch (error) {
    console.error('Hiba a csatolmányok listázásakor:', error);
    return [];
  }
});

// Demo/Trial handlers
ipcMain.handle('is-demo-over', async () => {
  let licence = null;
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      licence = await win.webContents.executeJavaScript('localStorage.getItem("licence")');
    }
  } catch (e) {
    console.error('[is-demo-over] Could not read licence:', e);
  }

  const demoOver = await isDemoOver(licence);
  if (demoOver && licence) {
    await setTrialEndedForLicence(licence);
  }
  return demoOver;
});

ipcMain.handle('get-trial-status', async () => {
  let licence = null;
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      licence = await win.webContents.executeJavaScript('localStorage.getItem("licence")');
    }
  } catch (e) {
    console.error('[get-trial-status] Could not read licence:', e);
  }

  const trialStatus = await getTrialStatusFromDb(licence);
  if (trialStatus) {
    return { ...trialStatus, licence };
  }

  const log = readSentEmailsLog();
  return {
    trialEndDate: null,
    remainingGenerations: null,
    licence: licence,
    sentEmailsCount: Array.isArray(log) ? log.length : 0
  };
});

// Settings handlers
ipcMain.handle('setApiKey', async (event, apiKey) => {
  const config = readConfig();
  config.OPENAI_API_KEY = apiKey;
  saveConfig(config);
  openai.apiKey = apiKey;
  return true;
});

ipcMain.handle('getApiKey', async () => {
  const apiKey = await getSecret('OpenAPIKey');
  if (!apiKey) throw new Error('OpenAPI kulcs nincs beállítva!');
  return apiKey;
});

ipcMain.handle('getPromptSettings', async () => {
  const settings = getSettings();
  return {
    greeting: settings.greeting || defaultSettings.greeting,
    signature: settings.signature || defaultSettings.signature,
    signatureText: settings.signatureText || defaultSettings.signatureText,
    signatureImage: settings.signatureImage || defaultSettings.signatureImage
  };
});

ipcMain.handle('savePromptSettings', async (event, { greeting, signature, signatureText, signatureImage }) => {
  const settings = getSettings();
  settings.greeting = greeting;
  settings.signature = signature;
  settings.signatureText = signatureText;
  settings.signatureImage = signatureImage;
  saveSettings(settings);
  return true;
});

ipcMain.handle('getWebSettings', async () => {
  const settings = getSettings();
  return { webUrls: settings.webUrls || defaultSettings.webUrls };
});

ipcMain.handle('saveWebSettings', async (event, { webUrls }) => {
  const settings = getSettings();
  settings.webUrls = Array.isArray(webUrls) ? webUrls : [];
  saveSettings(settings);
  return true;
});

ipcMain.handle('getAutoSend', async () => getSetting('autoSend', false));
ipcMain.handle('getHalfAutoSend', async () => getSetting('halfAuto', false));

ipcMain.handle('setAutoSend', async (event, value) => {
  setSetting('autoSend', value);
  startEmailMonitoring();
});

ipcMain.handle('setHalfAutoSend', async (event, value) => {
  setSetting('halfAuto', value);
  startEmailMonitoring();
});

ipcMain.handle('setAutoSendTimes', async (event, { startTime, endTime }) => {
  const settings = getSettings();
  settings.autoSendStartTime = startTime;
  settings.autoSendEndTime = endTime;
  saveSettings(settings);
  return true;
});

ipcMain.handle('getAutoSendTimes', async () => {
  const settings = getSettings();
  return { startTime: settings.autoSendStartTime, endTime: settings.autoSendEndTime };
});

ipcMain.handle('getMinEmailDate', async () => getSetting('minEmailDate', ''));
ipcMain.handle('setMinEmailDate', async (event, dateStr) => { setSetting('minEmailDate', dateStr); return true; });
ipcMain.handle('getMaxEmailDate', async () => getSetting('maxEmailDate', ''));
ipcMain.handle('setMaxEmailDate', async (event, dateStr) => { setSetting('maxEmailDate', dateStr); return true; });
ipcMain.handle('getFromDate', async () => getSetting('fromDate', ''));
ipcMain.handle('setFromDate', async (event, dateStr) => { setSetting('fromDate', dateStr); return true; });

ipcMain.handle('getIgnoredEmails', async () => getSetting('ignoredEmails', []));
ipcMain.handle('setIgnoredEmails', async (event, ignoredEmails) => {
  const cleaned = Array.isArray(ignoredEmails)
    ? ignoredEmails.filter(e => typeof e === 'string').map(e => e.trim()).filter(Boolean)
    : [];
  setSetting('ignoredEmails', cleaned);
  return true;
});

ipcMain.handle('getNotifyOnAutoReply', async () => getSetting('notifyOnAutoReply', false));
ipcMain.handle('setNotifyOnAutoReply', async (event, value) => { setSetting('notifyOnAutoReply', value); return true; });
ipcMain.handle('getNotificationEmail', async () => getSetting('notificationEmail', ''));
ipcMain.handle('setNotificationEmail', async (event, email) => { setSetting('notificationEmail', email); return true; });

ipcMain.handle('getDisplayMode', async () => getSetting('displayMode', 'windowed'));
ipcMain.handle('setDisplayMode', async (event, mode) => {
  if (!mainWindow) return false;
  setSetting('displayMode', mode);
  if (mode === 'fullscreen') {
    mainWindow.maximize();
  } else {
    mainWindow.unmaximize();
  }
  return true;
});

ipcMain.handle('getLeftNavbarMode', async () => getSetting('LeftNavBarOn', true));
ipcMain.handle('setLeftNavbarMode', async (event, mode) => {
  if (!mainWindow) return false;
  setSetting('LeftNavBarOn', mode);
  return true;
});

// Excel handlers
ipcMain.handle('excel-exists', async () => excelExists());
ipcMain.handle('get-excel-path', async () => getExcelPath());
ipcMain.handle('read-excel-file', async () => readExcelFile());
ipcMain.handle('save-excel-file', async (event, payload) => saveExcelFile(payload));
ipcMain.handle('upload-excel-file', async (event, fileContent) => uploadExcelFile(fileContent));
ipcMain.handle('lookup-excel-cell', async (event, params) => findExcelCell(params));

// Image handlers
ipcMain.handle('upload-image-file', async (event, fileContent) => {
  try {
    const imagesDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    const targetPath = path.join(imagesDir, 'signature.png');
    fs.writeFileSync(targetPath, Buffer.from(fileContent));
    setSetting('signatureImage', targetPath);
    return { success: true };
  } catch (error) {
    console.error('Hiba a kép fájl feltöltésekor:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-signature-image', async () => {
  try {
    const imagePath = path.join(__dirname, 'src', 'images', 'signature.png');
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    setSetting('signatureImage', '');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('upload-signature-image', async (event, fileContent) => {
  try {
    const imagesDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    const targetPath = path.join(imagesDir, 'signature.png');
    fs.writeFileSync(targetPath, Buffer.from(fileContent));
    setSetting('signatureImage', targetPath);
    return { success: true, path: targetPath };
  } catch (error) {
    console.error('Hiba a signature kép feltöltésekor:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getSignatureImageFileUrl', async () => {
  try {
    const settings = getSettings();
    if (!settings.signatureImage) return '';
    let absPath = settings.signatureImage;
    if (!path.isAbsolute(absPath)) {
      absPath = path.join(__dirname, settings.signatureImage);
    }
    if (!fs.existsSync(absPath)) return '';
    return 'file://' + absPath.replace(/\\/g, '/');
  } catch (e) {
    return '';
  }
});

// Dialog handlers
ipcMain.handle('show-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath);
      const filename = filePath.split(/[/\\]/).pop();
      return { success: true, content, filePath, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No file selected' };
});

ipcMain.handle('show-image-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] }]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath);
      return { success: true, content, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'No file selected' };
});

ipcMain.handle('show-directory-dialog', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, dirPath: result.filePaths[0] };
  }
  return { success: false, error: 'No directory selected' };
});

// Email handlers
ipcMain.handle('get-unread-emails', async () => {
  try {
    const cached = readCachedEmails();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
    const authState = getAuthState();
    if (authState.provider === 'gmail' || authState.provider === 'smtp') {
      const emails = await getEmailsBasedOnProvider();
      saveCachedEmails(emails);
      return emails;
    }
  } catch (error) {
    console.error('Hiba az emailek lekérésekor:', error);
    throw error;
  }
});

ipcMain.handle('get-email-by-id', async (event, id) => {
  try {
    return await getEmailByIdBasedOnProvider(id);
  } catch (error) {
    console.error('Hiba az email lekérésekor:', error);
    throw error;
  }
});

ipcMain.handle('get-user-email', async () => {
  try {
    const authState = getAuthState();
    if (authState.provider === 'smtp' && smtpHandler) {
      return smtpHandler.config.email;
    } else if (authState.provider === 'gmail') {
      const auth = await authorize();
      const gmail = google.gmail({ version: 'v1', auth });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return profile.data.emailAddress;
    }
    throw new Error('No valid email provider');
  } catch (error) {
    console.error('Hiba az email cím lekérésekor:', error);
    throw error;
  }
});

ipcMain.handle('generate-reply', async (event, email) => {
  console.log('[ipc] generate-reply invoked');
  const TIMEOUT_MS = 60 * 1000;
  try {
    const reply = await Promise.race([
      generateReply(email),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
    ]);
    return { subject: email?.subject || '', body: reply };
  } catch (error) {
    console.error('Hiba a válasz generálásakor:', error);
    return { subject: email?.subject || '', body: 'Sajnálom, nem sikerült választ generálni.' };
  }
});

ipcMain.handle('send-reply', async (event, { to, subject, body, emailId }) => {
  const result = await sendReply({ to, subject, body, emailId });
  if (result && result.success && emailId) {
    try {
      const authState = getAuthState();
      if (authState.provider === 'smtp' && smtpHandler) {
        await smtpHandler.markAsRead(emailId);
      } else if (authState.provider === 'gmail') {
        const auth = await authorize();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
          userId: 'me',
          id: emailId,
          requestBody: { removeLabelIds: ['UNREAD'] }
        });
      }
      if (!repliedEmailIds.includes(emailId)) {
        repliedEmailIds.push(emailId);
        saveRepliedEmails(repliedEmailIds);
      }
      removeEmailFromCache(emailId);
    } catch (err) {
      console.error('Nem sikerült olvasottnak jelölni:', err);
    }
  }
  return result;
});

ipcMain.handle('get-replied-email-ids', async () => repliedEmailIds.slice(-20));

ipcMain.handle('get-reply-stats', async () => {
  try {
    const sentLog = readSentEmailsLog();
    if (!sentLog || sentLog.length === 0) return [];
    const recent = sentLog.slice(-100);
    const counts = {};
    const now = new Date();
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      counts[d.toLocaleDateString('hu-HU')] = 0;
    }
    recent.forEach(e => {
      if (!e || !e.date) return;
      const d = new Date(e.date);
      if (isNaN(d)) return;
      const day = d.toLocaleDateString('hu-HU');
      if (day in counts) counts[day]++;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date.split('.').reverse().join('-')) - new Date(b.date.split('.').reverse().join('-')));
  } catch (e) {
    console.error('[get-reply-stats] Error:', e);
    return [];
  }
});

ipcMain.handle('read-sent-emails-log', async () => readSentEmailsLog());
ipcMain.handle('read-generated-replies', async () => readGeneratedReplies());
ipcMain.handle('save-generated-replies', async (event, replies) => saveGeneratedReplies(replies));

// Auth handlers
ipcMain.handle('login-with-gmail', async () => {
  try {
    const oAuth2Client = await authorize();
    let email = null;
    try {
      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      email = profile.data.emailAddress;
    } catch (err) {
      console.error('Nem sikerült lekérni a Gmail email címet:', err);
    }
    setGmailAuth(email);
    startEmailMonitoring();
    
    if (activationEmail && email) {
      await updateEmailInUse(email, activationEmail);
    }
    return true;
  } catch (error) {
    console.error('Gmail bejelentkezési hiba:', error);
    return false;
  }
});

ipcMain.handle('login-with-smtp', async (event, config) => {
  try {
    smtpHandler = new SmtpEmailHandler(config);
    try {
      smtpHandler.setOnMailCallback(() => {
        checkEmailsOnce().catch(err => console.error('Error in onMail check:', err));
      });
    } catch (e) {
      console.warn('Could not set onMail callback:', e);
    }
    const success = await smtpHandler.connect();
    
    if (success) {
      setSmtpAuth(config);
      if (activationEmail) {
        await updateEmailInUse(config.email, activationEmail);
      }
      // Start IDLE monitoring for real-time new mail notifications
      try {
        await smtpHandler.startIdleMonitoring();
        console.log('SMTP IDLE monitoring started');
      } catch (idleErr) {
        console.warn('Could not start IDLE monitoring:', idleErr);
      }
      startEmailMonitoring();
      return true;
    }
    return false;
  } catch (error) {
    console.error('SMTP bejelentkezési hiba:', error);
    setAuthState({ isAuthenticated: false, provider: null, credentials: null });
    return false;
  }
});

ipcMain.handle('check-auth-status', async () => {
  const authState = getAuthState();
  let email = null;
  if (authState.provider === 'smtp' && authState.credentials) {
    email = authState.credentials.email;
  }
  if (authState.provider === 'gmail') {
    if (authState.credentials && authState.credentials.email) {
      email = authState.credentials.email;
    } else {
      try {
        const auth = await authorize();
        const gmail = google.gmail({ version: 'v1', auth });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        email = profile.data.emailAddress;
        setAuthState({ credentials: { email } });
      } catch (err) {
        console.error('Nem sikerült lekérni a Gmail email címet:', err);
      }
    }
  }
  return { isAuthenticated: authState.isAuthenticated, provider: authState.provider, email };
});

ipcMain.handle('logout', async () => {
  try {
    if (smtpHandler) smtpHandler = null;
    stopEmailMonitoring();
    
    if (activationEmail) {
      await clearEmailInUse(activationEmail);
    }
    
    fs.writeFileSync(CACHED_EMAILS_FILE, JSON.stringify([]));
    logoutAuth();
    return true;
  } catch (error) {
    console.error('Hiba a kijelentkezés során:', error);
    return false;
  }
});

// Licence handlers
ipcMain.handle('check-licence', async (event, { email, licenceKey }) => checkLicenceInDb(email, licenceKey));
ipcMain.handle('is-licence-activated', async (event, { email, licenceKey }) => isLicenceActivated(email, licenceKey));
ipcMain.handle('activate-licence', async (event, { email, licenceKey }) => activateLicence(email, licenceKey));

// Activation email handlers
ipcMain.handle('set-activation-email', async (event, email) => {
  activationEmail = email;
  setSetting('activationEmail', email);
  console.log('Activation email set:', activationEmail);
  return true;
});

ipcMain.handle('get-activation-email', async () => getSetting('activationEmail', null) || activationEmail);

// Misc handlers
ipcMain.handle('check-internet', async () => checkInternetConnection());
ipcMain.handle('exit-app', () => app.quit());
ipcMain.handle('restart-app', () => { app.relaunch(); app.exit(0); });

ipcMain.handle('set-view', async (event, view) => {
  if (!mainWindow) return false;
  mainWindow.webContents.send('set-view', view);
  return true;
});

ipcMain.handle('set-email', async (event, email) => {
  try {
    setAuthState({ credentials: { email } });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-email', async () => {
  const authState = getAuthState();
  return authState.credentials?.email || null;
});

ipcMain.handle('get-licence-from-localstorage', async (event, licence) => licence || '');

ipcMain.handle('import-database', async (event, fileContent) => {
  try {
    const dbDir = app.getPath('userData');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const targetPath = path.join(dbDir, 'adatok.xlsx');
    fs.writeFileSync(targetPath, Buffer.from(fileContent));
    return { success: true, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copy-image-to-exe-root', async () => {
  const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1;
  if (!isPackaged) return true;
  try {
    const src = path.join(process.resourcesPath, 'app', 'signature.png');
    const exeDir = path.dirname(app.getPath('exe'));
    const dest = path.join(exeDir, 'signature.png');
    if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    return true;
  } catch (e) {
    console.error('Hiba a signature.png másolásakor:', e);
    return false;
  }
});

ipcMain.on('open-external', (event, url) => shell.openExternal(url));
ipcMain.on('log', (event, message) => {
  console.log(`[Renderer Log]: ${message}`);
  logToFile(`[Renderer Log]: ${message}`);
});

// =============================================================================
// WINDOW & APP LIFECYCLE
// =============================================================================

function createWindow() {
  const settings = getSettings();
  
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 1080,
    autoHideMenuBar: true,
    minWidth: 1300,
    minHeight: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  if (settings.displayMode === "fullscreen") {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));

  checkInternetConnection().then(hasInternet => {
    if (!hasInternet) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('no-internet-connection');
      });
    }
  });
}

app.whenReady().then(async () => {
  loadAuthState();
  createWindow();
  startInternetMonitoring();
  
  const authState = getAuthState();
  console.log('Initial auth state:', authState);

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    console.log('Frissítés elérhető!');
    if (mainWindow) mainWindow.webContents.send('update-ava');
  });

  autoUpdater.on('download-progress', (progressTrack) => {
    console.log(`Frissítés letöltése: ${progressTrack.percent}%`);
    if (mainWindow) mainWindow.webContents.send('update-download-progress', progressTrack.percent);
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('Frissítés letöltve!');
    if (mainWindow) mainWindow.webContents.send('update-ready');
  });

  autoUpdater.on('error', (err) => {
    console.error('Frissítési hiba:', err);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err.message);
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Frissítési hiba',
        message: `Hiba történt a frissítés során: ${err.message}`,
        buttons: ['OK']
      });
    }
  });

  if (authState.isAuthenticated) {
    try {
      if (authState.provider === 'gmail') {
        if (fs.existsSync(TOKEN_PATH)) {
          await authorize();
          startEmailMonitoring();
        } else {
          setAuthState({ isAuthenticated: false });
        }
      } else if (authState.provider === 'smtp' && authState.credentials) {
        console.log('Reconnecting to SMTP...');
        smtpHandler = new SmtpEmailHandler(authState.credentials);
        try {
          smtpHandler.setOnMailCallback(() => checkEmailsOnce().catch(err => console.error('Error in onMail check:', err)));
        } catch (e) {
          console.warn('Could not set onMail callback:', e);
        }
        const success = await smtpHandler.connect();
        if (success) {
          console.log('SMTP reconnection successful');
          // Start IDLE monitoring for real-time new mail notifications
          try {
            await smtpHandler.startIdleMonitoring();
            console.log('SMTP IDLE monitoring started');
          } catch (idleErr) {
            console.warn('Could not start IDLE monitoring:', idleErr);
          }
          startEmailMonitoring();
        } else {
          console.log('SMTP reconnection failed');
          setAuthState({ isAuthenticated: false });
        }
      }
    } catch (error) {
      console.error('Hiba az újracsatlakozás során:', error);
      setAuthState({ isAuthenticated: false });
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopEmailMonitoring();
  stopInternetMonitoring();
});
