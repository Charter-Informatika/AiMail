import fs from 'fs';
import { SETTINGS_FILE } from './file-helpers.js';

export const defaultSettings = {
  autoSend: false,
  halfAuto: false,
  autoSendStartTime: "08:00",
  autoSendEndTime: "16:00",
  displayMode: "windowed",
  LeftNavBarOn: true,
  greeting: "Tisztelt Ügyfelünk!",
  signature: "Üdvözlettel,\nAz Ön csapata",
  signatureText: "",
  signatureImage: "",
  ignoredEmails: [],
  minEmailDate: "", 
  maxEmailDate: "",
  notifyOnAutoReply: false,
  notificationEmail: "",
  webUrls: [],
  activationEmail: null
};

let settings = null;

export function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const fileSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return { ...defaultSettings, ...fileSettings, ignoredEmails: fileSettings.ignoredEmails || [] };
    }
  } catch (err) {
    console.error('Hiba a beállítások beolvasásakor:', err);
  }
  return { ...defaultSettings };
}

export function saveSettings(settingsToSave) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2), 'utf-8');
    settings = settingsToSave;
  } catch (err) {
    console.error('Hiba a beállítások mentésekor:', err);
  }
}

export function getSettings() {
  if (!settings) {
    settings = readSettings();
  }
  return settings;
}

export function updateSettings(updates) {
  const current = getSettings();
  const newSettings = { ...current, ...updates };
  saveSettings(newSettings);
  return newSettings;
}

export function getSetting(key, defaultValue = null) {
  const current = getSettings();
  return current[key] !== undefined ? current[key] : defaultValue;
}

export function setSetting(key, value) {
  const current = getSettings();
  current[key] = value;
  saveSettings(current);
  return current;
}

