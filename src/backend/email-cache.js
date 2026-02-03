let emailCache = {
  emails: [],
  lastFetchTime: 0,
  lastFullFetchTime: 0,
  emailIds: new Set(),
  metadata: new Map() 
};

const CACHE_CONFIG = {
  minFetchInterval: 30000, 
  staleThreshold: 300000,
  metadataCheckInterval: 15000, 
  maxCacheSize: 500
};

/**
 * Check if enough time has passed since last fetch
 * @param {boolean} metadataOnly - If true, use shorter interval for metadata checks
 * @returns {boolean} True if fetch is allowed
 */
export function canFetch(metadataOnly = false) {
  const now = Date.now();
  const interval = metadataOnly ? CACHE_CONFIG.metadataCheckInterval : CACHE_CONFIG.minFetchInterval;
  return (now - emailCache.lastFetchTime) >= interval;
}

/**
 * Check if cache needs a full refresh (is stale)
 * @returns {boolean} True if cache is stale
 */
export function isCacheStale() {
  const now = Date.now();
  return (now - emailCache.lastFullFetchTime) >= CACHE_CONFIG.staleThreshold;
}

/**
 * Get cached emails
 * @returns {Array} Cached email list
 */
export function getCachedEmails() {
  return emailCache.emails;
}

/**
 * Get timestamp of last fetch
 * @returns {number} Timestamp in milliseconds
 */
export function getLastFetchTime() {
  return emailCache.lastFetchTime;
}

/**
 * Update cache with new emails
 * @param {Array} emails - Array of email objects
 * @param {boolean} isFullFetch - Whether this was a full fetch (with bodies)
 */
export function updateCache(emails, isFullFetch = true) {
  const now = Date.now();
  
  // Merge new emails with existing cache
  const newEmailIds = new Set(emails.map(e => e.id));
  
  // Keep only emails that are still valid (in new fetch or recently cached)
  const mergedEmails = [];
  const seenIds = new Set();
  
  // Add new emails first (they take priority)
  for (const email of emails) {
    if (!seenIds.has(email.id)) {
      mergedEmails.push(email);
      seenIds.add(email.id);
    }
  }
  
  // Add cached emails that weren't in the new fetch (might be read but still relevant)
  for (const cachedEmail of emailCache.emails) {
    if (!seenIds.has(cachedEmail.id)) {
      mergedEmails.push(cachedEmail);
      seenIds.add(cachedEmail.id);
    }
  }
  
  // Limit cache size
  if (mergedEmails.length > CACHE_CONFIG.maxCacheSize) {
    mergedEmails.length = CACHE_CONFIG.maxCacheSize;
  }
  
  emailCache.emails = mergedEmails;
  emailCache.emailIds = new Set(mergedEmails.map(e => e.id));
  emailCache.lastFetchTime = now;
  
  if (isFullFetch) {
    emailCache.lastFullFetchTime = now;
  }
  
  // Update metadata map
  for (const email of mergedEmails) {
    emailCache.metadata.set(email.id, {
      from: email.from,
      subject: email.subject,
      date: email.date,
      hasBody: !!email.body,
      lastUpdated: now
    });
  }
  
  console.log(`[EmailCache] Updated cache with ${emails.length} emails. Total cached: ${mergedEmails.length}`);
}

/**
 * Get email from cache by ID
 * @param {string|number} id - Email ID
 * @returns {Object|null} Email object or null if not found
 */
export function getEmailById(id) {
  return emailCache.emails.find(e => e.id === id || String(e.id) === String(id)) || null;
}

/**
 * Check if email exists in cache
 * @param {string|number} id - Email ID
 * @returns {boolean} True if email is cached
 */
export function hasEmail(id) {
  return emailCache.emailIds.has(id) || emailCache.emailIds.has(String(id));
}

/**
 * Remove email from cache (after marking as read)
 * @param {string|number} id - Email ID
 */
export function removeEmail(id) {
  emailCache.emails = emailCache.emails.filter(e => e.id !== id && String(e.id) !== String(id));
  emailCache.emailIds.delete(id);
  emailCache.emailIds.delete(String(id));
  emailCache.metadata.delete(id);
  emailCache.metadata.delete(String(id));
}

/**
 * Clear entire cache
 */
export function clearCache() {
  emailCache = {
    emails: [],
    lastFetchTime: 0,
    lastFullFetchTime: 0,
    emailIds: new Set(),
    metadata: new Map()
  };
  console.log('[EmailCache] Cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    emailCount: emailCache.emails.length,
    lastFetchTime: emailCache.lastFetchTime,
    lastFullFetchTime: emailCache.lastFullFetchTime,
    cacheAge: Date.now() - emailCache.lastFetchTime,
    isStale: isCacheStale(),
    canFetch: canFetch()
  };
}

/**
 * Update cache configuration
 * @param {Object} config - Configuration object
 */
export function setCacheConfig(config) {
  if (config.minFetchInterval !== undefined) {
    CACHE_CONFIG.minFetchInterval = config.minFetchInterval;
  }
  if (config.staleThreshold !== undefined) {
    CACHE_CONFIG.staleThreshold = config.staleThreshold;
  }
  if (config.metadataCheckInterval !== undefined) {
    CACHE_CONFIG.metadataCheckInterval = config.metadataCheckInterval;
  }
  if (config.maxCacheSize !== undefined) {
    CACHE_CONFIG.maxCacheSize = config.maxCacheSize;
  }
}

/**
 * Get current cache configuration
 * @returns {Object} Current config
 */
export function getCacheConfig() {
  return { ...CACHE_CONFIG };
}

/**
 * Check if we need to fetch new emails based on known IDs
 * Useful for quick checks without fetching full content
 * @param {Array} currentIds - Array of current email IDs from server
 * @returns {Object} { hasNew: boolean, newIds: Array, removedIds: Array }
 */
export function compareWithCurrentIds(currentIds) {
  const currentSet = new Set(currentIds.map(id => String(id)));
  const cachedSet = new Set([...emailCache.emailIds].map(id => String(id)));
  
  const newIds = currentIds.filter(id => !cachedSet.has(String(id)));
  const removedIds = [...emailCache.emailIds].filter(id => !currentSet.has(String(id)));
  
  return {
    hasNew: newIds.length > 0,
    newIds,
    removedIds,
    hasChanges: newIds.length > 0 || removedIds.length > 0
  };
}

export default {
  canFetch,
  isCacheStale,
  getCachedEmails,
  getLastFetchTime,
  updateCache,
  getEmailById,
  hasEmail,
  removeEmail,
  clearCache,
  getCacheStats,
  setCacheConfig,
  getCacheConfig,
  compareWithCurrentIds
};
