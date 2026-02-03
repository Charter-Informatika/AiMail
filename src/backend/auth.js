import { findFile } from '../utils/findFile.js';
import fs from 'fs/promises';
import { google } from 'googleapis';
import path from 'path';
import open from 'open';
import http from 'http';

const CREDENTIALS_PATH = findFile('credentials.json');
const TOKEN_PATH = findFile('token.json');

let tokenGenerationPromise = null;

export async function authorize() {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8');
  const credentials = JSON.parse(content).installed;

  const oAuth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0] 
  );

  try {
    const token = await fs.readFile(TOKEN_PATH, 'utf-8');
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
  } catch (err) {
    if (tokenGenerationPromise) {
      console.log('Token generation already in progress, waiting...');
      await tokenGenerationPromise;
      const token = await fs.readFile(TOKEN_PATH, 'utf-8');
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    }

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
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const code = url.searchParams.get('code');
      if (code) {
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
        res.end('Hiba történt.');
        server.close();
        reject(new Error('Nem sikerült kódot kapni'));
      }
    });
    server.listen(3000);
  });
}
