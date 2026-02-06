import { findFile } from '../utils/findFile.js';
import fs from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import open from 'open';
import http from 'http';

const CREDENTIALS_PATH = findFile('credentials.json');
const TOKEN_PATH = findFile('token.json');

const AUTH_TIMEOUT_MS = 300000;

let tokenGenerationPromise = null;

/**
 * Authorize with Gmail OAuth2
 * @param {Object} options - Options
 * @param {boolean} options.forceNewToken - If true, will open browser for new token if needed. If false, throws error instead.
 * @returns {Promise<OAuth2Client>}
 */
export async function authorize({ forceNewToken = false } = {}) {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content).installed;

  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0] 
  );

  try {
    const token = await fs.readFile(TOKEN_PATH, 'utf-8');
    const parsedToken = JSON.parse(token);
    
    // Ellenőrizzük, hogy a token érvényes-e (van benne access_token vagy refresh_token)
    if (!parsedToken || (!parsedToken.access_token && !parsedToken.refresh_token)) {
      console.log('[auth] Token file exists but is empty or invalid');
      throw new Error('Invalid or empty token');
    }
    
    oAuth2Client.setCredentials(parsedToken);
    return oAuth2Client;
  } catch (err) {
    // Ha nincs forceNewToken, ne indítsunk böngészős bejelentkezést
    if (!forceNewToken) {
      console.log('[auth] No valid token and forceNewToken is false, throwing error');
      throw new Error('No valid Gmail token available');
    }
    
    if (tokenGenerationPromise) {
      console.log('Token generation already in progress, waiting...');
      await tokenGenerationPromise;
      const token = await fs.readFile(TOKEN_PATH, 'utf-8');
      oAuth2Client.setCredentials(parsedToken);
      return oAuth2Client;
    }

    console.log('[auth] Starting new token generation (forceNewToken=true)...');
    tokenGenerationPromise = getNewToken(oAuth2Client);
    try {
      await tokenGenerationPromise;
      return oAuth2Client;
    } finally {
      tokenGenerationPromise = null;
    }
  }
}

async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
],
  });

  console.log('Starting new token generation process...');
  await open(authUrl);

  const code = await waitForCodeFromLocalhost();
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens), 'utf-8');
  console.log('Token successfully saved to:', TOKEN_PATH);

  return oAuth2Client;
}

function waitForCodeFromLocalhost() {
  return new Promise((resolve, reject) => {
    let server = null;
    
    // Timeout - ha nem érkezik válasz időben
    const timeout = setTimeout(() => {
      console.log('[auth] Gmail authentication timed out');
      if (server) {
        try { server.close(); } catch (e) { /* ignore */ }
      }
      reject(new Error('Sikertelen Gmail hitelesítés - időtúllépés'));
    }, AUTH_TIMEOUT_MS);
    
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      
      // Ha a felhasználó megtagadta a hozzáférést
      if (error) {
        clearTimeout(timeout);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="hu">
          <head>
            <meta charset="UTF-8">
            <title>Sikertelen hitelesítés</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <h1>Sikertelen Gmail hitelesítés</h1>
            <p>A hozzáférés megtagadva vagy megszakítva.</p>
          </body>
          </html>
        `);
        server.close();
        reject(new Error('Sikertelen Gmail hitelesítés - hozzáférés megtagadva'));
        return;
      }
      
      if (code) {
        clearTimeout(timeout);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html lang="hu">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sikeres hitelesítés</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                margin-top: 50px;
              }
              h1 {
                color: #4CAF50;
              }
              p {
                color: #555;
              }
            </style>
          </head>
          <body>
            <h1>Sikeres hitelesítés!</h1>
            <p>Visszatérhetsz az alkalmazásba.</p>
          </body>
          </html>
        `);
        server.close();
        resolve(code);
      } else {
        clearTimeout(timeout);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html lang="hu">
          <head>
            <meta charset="UTF-8">
            <title>Sikertelen hitelesítés</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
              h1 { color: #f44336; }
            </style>
          </head>
          <body>
            <h1>Sikertelen Gmail hitelesítés</h1>
            <p>Hiba történt a hitelesítés során.</p>
          </body>
          </html>
        `);
        server.close();
        reject(new Error('Sikertelen Gmail hitelesítés'));
      }
    });
    
    server.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[auth] Server error:', err);
      reject(new Error('Sikertelen Gmail hitelesítés - szerver hiba'));
    });
    
    server.listen(3000);
  });
}
