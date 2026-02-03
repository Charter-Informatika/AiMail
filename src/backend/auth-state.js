import fs from 'fs';
import { getAuthStateFile, TOKEN_PATH } from './file-helpers.js';

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
  try {
    if (authState.provider === 'gmail' && fs.existsSync(TOKEN_PATH)) {
      fs.writeFileSync(TOKEN_PATH, '', 'utf-8');
    }
  } catch (e) {
    console.error('[logout] Failed to clear Gmail token file:', e);
  }
  
  resetAuthState();
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

