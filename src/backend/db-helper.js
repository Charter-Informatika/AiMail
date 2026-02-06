import { getSecret, setSecret } from '../utils/keytarHelper.js';

let API_BASE_URL = null;
let API_KEY = null;
let configInitialized = false;

async function initApiConfig() {
  if (configInitialized) {
    return { API_BASE_URL, API_KEY };
  }
  
  try {
    API_BASE_URL = await getSecret('API_BASE_URL');
  } catch (e) {
    console.warn('[API] Failed to get API_BASE_URL from keytar:', e?.message);
  }
  
  // Fallback URL ha nincs beállítva
  if (!API_BASE_URL) {
    API_BASE_URL = 'https://okosmail.hu/api'; 
    console.warn('[API] Using fallback API_BASE_URL:', API_BASE_URL);
  }
  
  try {
    API_KEY = await getSecret('DESKTOP_API_KEY');
  } catch (e) {
    console.warn('[API] Failed to get DESKTOP_API_KEY from keytar:', e?.message);
  }
  
  configInitialized = true;
  return { API_BASE_URL, API_KEY };
}

/**
 * Alap fetch wrapper hibakezeléssel és retry logikával
 */
async function apiRequest(endpoint, method = 'POST', body = null, retries = 3) {
  const config = await initApiConfig();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (config.API_KEY) {
        headers['X-API-Key'] = config.API_KEY;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${config.API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[API] ${endpoint} failed (${response.status}):`, data);
        
        if (response.status === 429 && attempt < retries) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          console.log(`[API] Rate limited, retrying after ${retryAfter}s...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }
        
        return { success: false, error: data.error || `HTTP ${response.status}` };
      }

      return data;
    } catch (error) {
      console.error(`[API] ${endpoint} error (attempt ${attempt}/${retries}):`, error?.message || error);
      
      if (attempt < retries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      
      return { success: false, error: 'Hálózati hiba: ' + (error?.message || 'Ismeretlen hiba') };
    }
  }
  
  return { success: false, error: 'Maximális újrapróbálkozás elérve' };
}

/**
 * Ellenőrzi, hogy a megadott email és licenckulcs érvényes-e
 * @param {string} email 
 * @param {string} licenceKey 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function checkLicenceInDb(email, licenceKey) {
  console.log('[API] checkLicenceInDb called for:', email);
  return await apiRequest('/licence/check', 'POST', { email, licenceKey });
}

/**
 * Ellenőrzi, hogy a licenc már aktiválva van-e
 * @param {string} email 
 * @param {string} licenceKey 
 * @returns {Promise<boolean>}
 */
export async function isLicenceActivated(email, licenceKey) {
  console.log('[API] isLicenceActivated called for:', email);
  const result = await apiRequest('/licence/status', 'POST', { email, licenceKey });
  
  if (!result.success) {
    // Hiba esetén true-t adunk vissza, hogy biztonságos legyen (block activation)
    console.warn('[API] isLicenceActivated failed, returning true for safety');
    return true;
  }
  
  return result.data?.licenceActivated === true;
}

/**
 * Aktiválja a licencet és beállítja a próbaidőszakot (90 nap)
 * @param {string} email 
 * @param {string} licenceKey 
 * @returns {Promise<{success: boolean, error?: string, trialEndDate?: string}>}
 */
export async function activateLicence(email, licenceKey) {
  console.log('[API] activateLicence called for:', email);
  return await apiRequest('/licence/activate', 'POST', { email, licenceKey });
}

/**
 * Beállítja, hogy a próbaidőszak véget ért
 * @param {string} licence 
 * @returns {Promise<boolean>}
 */
export async function setTrialEndedForLicence(licence) {
  console.log('[API] setTrialEndedForLicence called');
  const result = await apiRequest('/licence/trial-ended', 'POST', { licenceKey: licence });
  return result.success === true;
}

/**
 * Lekéri a próbaidőszak státuszát
 * @param {string} licence 
 * @returns {Promise<{trialEndDate: string|null, remainingGenerations: number|null}|null>}
 */
export async function getTrialStatusFromDb(licence) {
  if (!licence) {
    console.log('[API] getTrialStatusFromDb: no licence provided');
    return null;
  }
  
  console.log('[API] getTrialStatusFromDb called');
  const result = await apiRequest('/licence/status-by-key', 'POST', { licenceKey: licence });
  
  if (!result.success) {
    console.warn('[API] getTrialStatusFromDb failed:', result.error);
    return null;
  }
  
  return {
    trialEndDate: result.data?.trialEndDate || null,
    remainingGenerations: result.data?.remainingGenerations ?? null,
  };
}

/**
 * Csökkenti a hátralevő generációk számát
 * @param {string} userEmail 
 * @returns {Promise<boolean>}
 */
export async function decrementRemainingGenerations(userEmail) {
  if (!userEmail) {
    console.log('[API] decrementRemainingGenerations: no email provided');
    return false;
  }
  
  console.log('[API] decrementRemainingGenerations called for:', userEmail);
  const result = await apiRequest('/licence/decrement-generations', 'POST', { email: userEmail });
  
  if (result.success) {
    console.log('[API] Decremented remainingGenerations, new value:', result.remainingGenerations);
    return true;
  }
  
  console.error('[API] decrementRemainingGenerations failed:', result.error);
  return false;
}

/**
 * Beállítja az aktuálisan használt email címet (bejelentkezéskor)
 * @param {string} emailInUse - A bejelentkezett email
 * @param {string} activationEmail - A licenchez tartozó email
 * @returns {Promise<boolean>}
 */
export async function updateEmailInUse(emailInUse, activationEmail) {
  console.log('[API] updateEmailInUse called');
  const result = await apiRequest('/licence/email-in-use', 'POST', { 
    activationEmail, 
    emailInUse 
  });
  
  if (!result.success) {
    console.error('[API] emailInUse update failed:', result.error);
  }
  
  return result.success === true;
}

/**
 * Törli az aktuálisan használt email címet (kijelentkezéskor)
 * @param {string} activationEmail - A licenchez tartozó email
 * @returns {Promise<boolean>}
 */
export async function clearEmailInUse(activationEmail) {
  console.log('[API] clearEmailInUse called for:', activationEmail);
  const result = await apiRequest('/licence/email-in-use', 'DELETE', { activationEmail });
  
  if (!result.success) {
    console.error('[logout] Failed to clear emailInUse:', result.error);
  }
  
  return result.success === true;
}


/**
 * Beállítja az API konfigurációt (első indításkor vagy beállításokban)
 * @param {string} baseUrl - Az API szerver URL-je
 * @param {string} apiKey - Az API kulcs
 */
export async function setApiConfig(baseUrl, apiKey) {
  if (baseUrl) {
    await setSecret('API_BASE_URL', baseUrl);
    API_BASE_URL = baseUrl;
  }
  
  if (apiKey) {
    await setSecret('DESKTOP_API_KEY', apiKey);
    API_KEY = apiKey;
  }
  
  configInitialized = true;
  console.log('[API] Config saved to keytar');
}

/**
 * Teszteli az API kapcsolatot
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testApiConnection() {
  try {
    const result = await apiRequest('/licence/check', 'POST', { 
      email: 'connection-test@test.local', 
      licenceKey: 'TEST0000TEST0000' 
    });
    
    if (result && typeof result === 'object') {
      return { success: true };
    }
    return { success: false, error: 'Nem érkezett válasz' };
  } catch (error) {
    return { success: false, error: error?.message || 'Kapcsolódási hiba' };
  }
}

/**
 * Lekéri az aktuális API konfigurációt (debug célokra)
 * @returns {Promise<{baseUrl: string, hasApiKey: boolean}>}
 */
export async function getApiConfig() {
  await initApiConfig();
  return {
    baseUrl: API_BASE_URL,
    hasApiKey: !!API_KEY
  };
}