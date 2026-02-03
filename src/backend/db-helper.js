import mysql from 'mysql2/promise';
import { getSecret } from '../utils/keytarHelper.js';


export async function createDbConnection() {
  let dbUrl = null;
  try {
    dbUrl = await getSecret('DATABASE_URL');
  } catch (e) {
    console.warn('[DB] getSecret failed, using fallback:', e?.message || e);
  }
  
  if (dbUrl) {
    try {
      const connection = await mysql.createConnection(dbUrl);
      return connection;
    } catch (err) {
      console.warn('[DB] Primary connection failed, trying fallback:', err?.message || err);
    }
  }
  
}

export async function setTrialEndedForLicence(licence) {
  try {
    const connection = await createDbConnection();
    const [result] = await connection.execute(
      'UPDATE user SET trialEnded = 1 WHERE licence = ?',
      [licence]
    );
    console.log('[SQL] UPDATE result:', result);
    await connection.end();
    return result.affectedRows > 0;
  } catch (err) {
    console.error('TrialEnded frissítési hiba:', err);
    return false;
  }
}

export async function checkLicenceInDb(email, licenceKey) {
  let connection;
  try {
    connection = await createDbConnection();
    const [rows] = await connection.execute(
      'SELECT id FROM user WHERE email = ? AND licence = ? LIMIT 1',
      [email, licenceKey]
    );

    if (rows && rows.length > 0) {
      return { success: true };
    }
    return { success: false, error: 'Hibás licenc vagy email.' };
  } catch (err) {
    console.error('Licenc ellenőrzési hiba:', err);
    return { success: false, error: 'Adatbázis hiba.' };
  } finally {
    try { if (connection) await connection.end(); } catch (e) {}
  }
}

export async function isLicenceActivated(email, licenceKey) {
  let connection;
  try {
    connection = await createDbConnection();
    const [rows] = await connection.execute(
      'SELECT licenceActivated FROM user WHERE email = ? AND licence = ? LIMIT 1',
      [email, licenceKey]
    );

    if (!rows || rows.length === 0) {
      return false;
    }

    return Number(rows[0].licenceActivated) === 1;
  } catch (error) {
    console.error('Error checking licence activation:', error);
    return true; // On error, return true to be safe and block activation
  } finally {
    try { if (connection) await connection.end(); } catch (e) {}
  }
}

export async function activateLicence(email, licenceKey) {
  let connection;
  try {
    connection = await createDbConnection();
    const [result] = await connection.execute(
      'UPDATE user SET licenceActivated = 1, TrialEndDate = DATE_ADD(NOW(), INTERVAL 90 DAY) WHERE email = ? AND licence = ?',
      [email, licenceKey]
    );
    const success = result && (result.affectedRows === undefined ? true : result.affectedRows > 0);
    return { success };
  } catch (err) {
    console.error('Error activating licence:', err);
    return { success: false, error: 'Adatbázis hiba.' };
  } finally {
    try { if (connection) await connection.end(); } catch (e) {}
  }
}

export async function updateEmailInUse(emailInUse, activationEmail) {
  let connection;
  try {
    connection = await createDbConnection();
    const [result] = await connection.execute(
      'UPDATE user SET emailInUse = ? WHERE email = ?;',
      [emailInUse, activationEmail]
    );
    console.log('[SQL] UPDATE result:', result);
    await connection.end();
    return result.affectedRows > 0;
  } catch (err) {
    console.error('[DB] emailInUse update error:', err);
    return false;
  }
}

export async function clearEmailInUse(activationEmail) {
  let connection;
  try {
    connection = await createDbConnection();
    const [result] = await connection.execute(
      'UPDATE user SET emailInUse = NULL WHERE email = ?;',
      [activationEmail]
    );
    console.log('[logout] Cleared emailInUse:', activationEmail, 'result:', result);
    await connection.end();
    return result.affectedRows > 0;
  } catch (err) {
    console.error('[logout] Failed to clear emailInUse:', err);
    return false;
  }
}

export async function getTrialStatusFromDb(licence) {
  try {
    if (!licence) return null;
    const connection = await createDbConnection();
    const [rows] = await connection.execute(
      'SELECT trialEndDate, remainingGenerations FROM user WHERE licence = ? LIMIT 1',
      [licence]
    );
    await connection.end();
    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0];
      return {
        trialEndDate: row.trialEndDate || null,
        remainingGenerations: typeof row.remainingGenerations !== 'undefined' && row.remainingGenerations !== null 
          ? Number(row.remainingGenerations) 
          : null
      };
    }
    return null;
  } catch (err) {
    console.error('[getTrialStatusFromDb] DB error:', err);
    return null;
  }
}

export async function decrementRemainingGenerations(userEmail) {
  try {
    if (!userEmail) return false;
    const connection = await createDbConnection();
    await connection.execute(
      'UPDATE user SET remainingGenerations = GREATEST(0, remainingGenerations - 1) WHERE email = ?',
      [userEmail]
    );
    await connection.end();
    console.log('[DB] Decremented remainingGenerations for', userEmail);
    return true;
  } catch (dbErr) {
    console.error('[DB] decrementRemainingGenerations error:', dbErr);
    return false;
  }
}
