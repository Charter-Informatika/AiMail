import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { findFile } from '../utils/findFile.js';

let _configFile = null;
let _authStateFile = null;

function getUserDataFile(filename) {
  return path.join(app.getPath('userData'), filename);
}

function migrateToUserData(filename) {
  const userDataPath = getUserDataFile(filename);

  if (fs.existsSync(userDataPath)) {
    return userDataPath;
  }
  try {
    const oldPath = findFile(filename);
    if (oldPath && fs.existsSync(oldPath)) {
      const userDataDir = app.getPath('userData');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      fs.copyFileSync(oldPath, userDataPath);
      console.log(`[Migration] ${filename} átmásolva: ${oldPath} -> ${userDataPath}`);
    }
  } catch (err) {

  }
  return userDataPath;
}

export const REPLIED_EMAILS_FILE = migrateToUserData('repliedEmails.json');
export const GENERATED_REPLIES_FILE = migrateToUserData('GeneratedReplies.json');
export const CACHED_EMAILS_FILE = migrateToUserData('cached_emails.json');
export const TOKEN_PATH = migrateToUserData('token.json');
export const SETTINGS_FILE = migrateToUserData('settings.json');
export const SENT_EMAILS_LOG_FILE = migrateToUserData('sentEmailsLog.json');

export function getConfigFile() {
  if (!_configFile) _configFile = path.join(app.getPath('userData'), 'config.json');
  return _configFile;
}

export function getAuthStateFile() {
  if (!_authStateFile) _authStateFile = path.join(app.getPath('userData'), 'auth_state.json');
  return _authStateFile;
}

export const CONFIG_FILE = null; 
export const AUTH_STATE_FILE = null;

export function readConfig() {
  try {
    const configFile = getConfigFile();
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
  } catch (err) {
    console.error('Hiba a konfiguráció beolvasásakor:', err);
  }
  return {};
}

export function saveConfig(config) {
  try {
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Hiba a konfiguráció mentésekor:', err);
  }
}

export function readRepliedEmails() {
  try {
    if (fs.existsSync(REPLIED_EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(REPLIED_EMAILS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Hiba a válaszolt levelek beolvasásakor:', err);
  }
  return [];
}

export function saveRepliedEmails(ids) {
  try {
    fs.writeFileSync(REPLIED_EMAILS_FILE, JSON.stringify(ids, null, 2), 'utf-8');
  } catch (err) {
    console.error('Hiba a válaszolt levelek mentésekor:', err);
  }
}

export function readGeneratedReplies() {
  try {
    if (fs.existsSync(GENERATED_REPLIES_FILE)) {
      const data = fs.readFileSync(GENERATED_REPLIES_FILE, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (err) {
    console.error('Hiba a generated_replies.json beolvasásakor:', err);
    return {};
  }
}

export function saveGeneratedReplies(replies) {
  try {
    fs.writeFileSync(GENERATED_REPLIES_FILE, JSON.stringify(replies, null, 2), 'utf-8');
  } catch (err) {
    console.error('Hiba a generated_replies.json mentésekor:', err);
  }
}

export function readCachedEmails() {
  try {
    if (fs.existsSync(CACHED_EMAILS_FILE)) {
      const data = fs.readFileSync(CACHED_EMAILS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Hiba a cached_emails.json beolvasásakor:', err);
  }
  return [];
}

export function saveCachedEmails(emails) {
  try {
    fs.writeFileSync(CACHED_EMAILS_FILE, JSON.stringify(Array.isArray(emails) ? emails : [], null, 2), 'utf-8');
  } catch (err) {
    console.error('Hiba a cached_emails.json mentésekor:', err);
  }
}

export function readSentEmailsLog() {
  try {
    if (fs.existsSync(SENT_EMAILS_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(SENT_EMAILS_LOG_FILE, 'utf-8'));
    }
    return [];
  } catch (err) {
    console.error('[readSentEmailsLog] Error reading sentEmailsLog.json:', err);
    return [];
  }
}

export function appendSentEmailLog(entry) {
  try {
    let log = [];
    if (fs.existsSync(SENT_EMAILS_LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(SENT_EMAILS_LOG_FILE, 'utf-8'));
    }
    log.push(entry);
    if (log.length > 500) log = log.slice(-500);
    fs.writeFileSync(SENT_EMAILS_LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
  } catch (err) {
    console.error('Hiba a sentEmailsLog.json írásakor:', err);
  }
}

export function logToFile(message) {
  try {
    const logFilePath = path.join(app.getPath('userData'), 'app.log');
    
    if (!fs.existsSync(app.getPath('userData'))) {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}

export function encodeRFC2047Name(name) {
  if (/[^ -~]/.test(name)) {
    return `=?UTF-8?B?${Buffer.from(name, 'utf-8').toString('base64')}?=`;
  }
  return name;
}

export function formatAddress(address) {
  const match = address.match(/^(.*)<(.+@.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, '');
    const email = match[2].trim();
    return `"${encodeRFC2047Name(name)}" <${email}>`;
  }
  return address;
}

export function extractEmailAddress(fromField) {
  const match = fromField && fromField.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1] : null;
}

export function safeTrim(text, maxChars) {
  if (!text) return '';
  if (typeof text !== 'string') text = String(text);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[...további tartalom levágva...]';
}
