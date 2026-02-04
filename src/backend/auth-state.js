import fs from 'fs';
import { getAuthStateFile, TOKEN_PATH } from './file-helpers.js';
import { findFile } from '../utils/findFile.js';

let authState = {
  isAuthenticated: false,
  provider: null,
  credentials: null
};

export function saveAuthState() {
  try {
    fs.writeFileSync(getAuthStateFile(), JSON.stringify(authState));
  } catch (err) {
    console.error('Hiba az authentikációs állapot mentésekor:', err);
  }
}

export function loadAuthState() {
  try {
    const authStateFile = getAuthStateFile();
    if (fs.existsSync(authStateFile)) {
      const data = fs.readFileSync(authStateFile, 'utf-8');
      authState = JSON.parse(data);
      console.log('Auth state loaded:', authState);
    }
  } catch (err) {
    console.error('Hiba az authentikációs állapot betöltésekor:', err);
    resetAuthState();
  }
}

export function resetAuthState() {
  authState = {
    isAuthenticated: false,
    provider: null,
    credentials: null
  };
  saveAuthState();
}

export function getAuthState() {
  return authState;
}

export function setAuthState(newState) {
  authState = { ...authState, ...newState };
  saveAuthState();
  return authState;
}

export function setGmailAuth(email = null) {
  authState = {
    isAuthenticated: true,
    provider: 'gmail',
    credentials: { email }
  };
  saveAuthState();
  return authState;
}

export function setSmtpAuth(config) {
  authState = {
    isAuthenticated: true,
    provider: 'smtp',
    credentials: {
      email: config.email,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      useSSL: config.useSSL,
      password: config.password
    }
  };
  saveAuthState();
  return authState;
}

export function logout() {
  console.log('[logout] Starting logout, provider:', authState.provider);
  
  // Gmail token törlése - mindkét lehetséges helyről (üres fájlt hagyunk)
  if (authState.provider === 'gmail') {
    // 1. userData mappában lévő token (file-helpers.js TOKEN_PATH)
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        fs.writeFileSync(TOKEN_PATH, '{}', 'utf-8');
        console.log('[logout] Cleared token in userData:', TOKEN_PATH);
      }
    } catch (e) {
      console.error('[logout] Failed to clear Gmail token file (userData):', e);
    }
    
    // 2. Projekt mappában lévő token (findFile által megtalált)
    try {
      const projectTokenPath = findFile('token.json');
      if (projectTokenPath && fs.existsSync(projectTokenPath)) {
        fs.writeFileSync(projectTokenPath, '{}', 'utf-8');
        console.log('[logout] Cleared token in project:', projectTokenPath);
      }
    } catch (e) {
      console.error('[logout] Failed to clear Gmail token file (project):', e);
    }
  }
  
  resetAuthState();
  console.log('[logout] Auth state reset complete');
}

export function isGmailProvider() {
  return authState.provider === 'gmail';
}

export function isSmtpProvider() {
  return authState.provider === 'smtp';
}

export function isAuthenticated() {
  return authState.isAuthenticated;
}

