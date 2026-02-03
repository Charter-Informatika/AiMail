import { OpenAI } from 'openai';
import { getSecret } from '../utils/keytarHelper.js';

// Ollama szerver beállítások
const OLLAMA_BASE_URL = 'http://192.168.88.12:11434';
const OLLAMA_TIMEOUT_MS = 30000;


const LOCAL_CHAT_MODEL = 'llama3.1:8b';
const LOCAL_VISION_MODEL = 'llava:13b'; 
const LOCAL_EMBEDDING_MODEL = 'nomic-embed-text'; 

const OPENAI_CHAT_MODEL = 'gpt-4o-mini';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

// Cache az OpenAI klienshez
let openaiClient = null;

async function getOpenAI() {
  if (openaiClient) return openaiClient;
  const key = await getSecret('OpenAPIKey');
  if (!key) throw new Error('OpenAPIKey not set in keytar');
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (err) {
    console.log('[local-ai-helper] Ollama not available:', err?.message || err);
    return false;
  }
}

async function isModelAvailable(modelName) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!response.ok) return false;
    
    const data = await response.json();
    const models = data.models || [];
    return models.some(m => m.name === modelName || m.name.startsWith(modelName.split(':')[0]));
  } catch (err) {
    return false;
  }
}

/**
 * Chat completion - először helyi AI, utána OpenAI fallback
 * 
 * @param {string} systemPrompt - Rendszer prompt
 * @param {string} userPrompt - Felhasználói prompt
 * @param {object} options - Opcionális beállítások (temperature, max_tokens)
 * @returns {Promise<string>} - AI válasz
 */
async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const { temperature = 1, maxTokens = 2000 } = options;

  // 1. Próbáljuk a helyi Ollama-t
  try {
    console.log('[local-ai-helper] Trying local Ollama for chat...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const promptForOllama = `${systemPrompt}\n\n${userPrompt}`;
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_CHAT_MODEL,
        prompt: promptForOllama,
        temperature,
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (typeof data?.response === 'string' && data.response.trim().length > 0) {
        console.log('[local-ai-helper] Local Ollama chat succeeded.');
        return data.response;
      }
    }
    console.warn('[local-ai-helper] Local Ollama returned empty or invalid response');
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('[local-ai-helper] Local Ollama chat timed out');
    } else {
      console.warn('[local-ai-helper] Local Ollama chat failed:', err?.message || err);
    }
  }

  // 2. OpenAI fallback
  try {
    console.log('[local-ai-helper] Falling back to OpenAI for chat...');
    const openai = await getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    });
    return completion?.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('[local-ai-helper] OpenAI chat fallback failed:', err?.message || err);
    throw err;
  }
}

/**
 * Vision/Képleírás - először helyi AI, utána OpenAI fallback
 * 
 * @param {string} imageBase64 - Base64 kódolt kép
 * @param {string} prompt - Képleírás prompt
 * @returns {Promise<string>} - Képleírás
 */
async function describeImage(imageBase64, prompt = 'Írj rövid, informatív leírást erről a képről magyarul!') {
  // 1. Próbáljuk a helyi Ollama-t LLaVA modellel
  try {
    console.log('[local-ai-helper] Trying local Ollama LLaVA for image description...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    let base64Data = imageBase64;
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_VISION_MODEL,
        prompt: prompt,
        images: [base64Data],
        stream: false
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (typeof data?.response === 'string' && data.response.trim().length > 0) {
        console.log('[local-ai-helper] Local Ollama LLaVA succeeded.');
        return data.response;
      }
    }
    console.warn('[local-ai-helper] Local Ollama LLaVA returned empty response');
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('[local-ai-helper] Local Ollama LLaVA timed out');
    } else {
      console.warn('[local-ai-helper] Local Ollama LLaVA failed:', err?.message || err);
    }
  }

  // 2. OpenAI fallback
  try {
    console.log('[local-ai-helper] Falling back to OpenAI for image description...');
    const openai = await getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      max_tokens: 200
    });
    return completion?.choices?.[0]?.message?.content || '(nincs leírás)';
  } catch (err) {
    console.error('[local-ai-helper] OpenAI image description fallback failed:', err?.message || err);
    return '(AI leírás sikertelen)';
  }
}

/**
 * Embedding létrehozása - először helyi AI, utána OpenAI fallback
 * 
 * @param {string|string[]} input - Szöveg(ek) az embeddinghez
 * @returns {Promise<number[]|number[][]>} - Embedding vektor(ok)
 */
async function createEmbedding(input) {
  const isBatch = Array.isArray(input);
  const inputs = isBatch ? input : [input];

  // 1. Próbáljuk a helyi Ollama-t
  try {
    console.log('[local-ai-helper] Trying local Ollama for embeddings...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const embeddings = [];
    for (const text of inputs) {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LOCAL_EMBEDDING_MODEL,
          prompt: String(text)
        }),
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.embedding && Array.isArray(data.embedding)) {
          embeddings.push(data.embedding);
        } else {
          throw new Error('Invalid embedding response from Ollama');
        }
      } else {
        throw new Error(`Ollama embedding failed with status: ${response.status}`);
      }
    }
    clearTimeout(timeout);

    if (embeddings.length === inputs.length) {
      console.log('[local-ai-helper] Local Ollama embeddings succeeded.');
      return isBatch ? embeddings : embeddings[0];
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('[local-ai-helper] Local Ollama embeddings timed out');
    } else {
      console.warn('[local-ai-helper] Local Ollama embeddings failed:', err?.message || err);
    }
  }

  // 2. OpenAI fallback
  try {
    console.log('[local-ai-helper] Falling back to OpenAI for embeddings...');
    const openai = await getOpenAI();
    const response = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: inputs
    });
    
    const embeddings = response?.data?.map(d => d.embedding) || [];
    return isBatch ? embeddings : embeddings[0];
  } catch (err) {
    console.error('[local-ai-helper] OpenAI embeddings fallback failed:', err?.message || err);
    throw err;
  }
}

/**
 * Batch embedding létrehozása nagyobb mennyiségű szöveghez
 * 
 * @param {string[]} inputs - Szövegek tömbje
 * @param {number} batchSize - Batch méret (alapértelmezett: 100)
 * @returns {Promise<number[][]>} - Embedding vektorok
 */
async function createEmbeddingsBatch(inputs, batchSize = 100) {
  const results = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    try {
      const embeddings = await createEmbedding(batch);
      if (Array.isArray(embeddings)) {
        results.push(...embeddings);
      }
    } catch (err) {
      console.error(`[local-ai-helper] Batch ${i}-${i + batchSize} failed:`, err?.message || err);
      for (const text of batch) {
        try {
          const embedding = await createEmbedding(text);
          results.push(embedding);
        } catch (singleErr) {
          console.error('[local-ai-helper] Single embedding failed:', singleErr?.message || singleErr);
          results.push(null);
        }
        await sleep(100);
      }
    }
    await sleep(200);
  }

  return results;
}

/**
 * Letölthető helyi modellek listája
 */
const RECOMMENDED_LOCAL_MODELS = {
  chat: [
    {
      name: 'llama3.1:8b',
      description: 'Meta Llama 3.1 8B - Kiváló általános célú modell',
      size: '~4.7GB',
      command: 'ollama pull llama3.1:8b'
    },
    {
      name: 'llama3.1:70b',
      description: 'Meta Llama 3.1 70B - Nagy teljesítményű modell (erős GPU szükséges)',
      size: '~40GB',
      command: 'ollama pull llama3.1:70b'
    },
    {
      name: 'mistral:7b',
      description: 'Mistral 7B - Gyors és hatékony modell',
      size: '~4.1GB',
      command: 'ollama pull mistral:7b'
    },
    {
      name: 'gemma2:9b',
      description: 'Google Gemma 2 9B - Modern, hatékony modell',
      size: '~5.5GB',
      command: 'ollama pull gemma2:9b'
    },
    {
      name: 'qwen2.5:7b',
      description: 'Alibaba Qwen 2.5 7B - Többnyelvű támogatás',
      size: '~4.4GB',
      command: 'ollama pull qwen2.5:7b'
    }
  ],
  vision: [
    {
      name: 'llava:13b',
      description: 'LLaVA 13B - Képfelismerés és leírás',
      size: '~8GB',
      command: 'ollama pull llava:13b'
    },
    {
      name: 'llava:7b',
      description: 'LLaVA 7B - Könnyebb képfelismerő modell',
      size: '~4.5GB',
      command: 'ollama pull llava:7b'
    },
    {
      name: 'bakllava',
      description: 'BakLLaVA - Alternatív képfelismerő',
      size: '~4.5GB',
      command: 'ollama pull bakllava'
    }
  ],
  embedding: [
    {
      name: 'nomic-embed-text',
      description: 'Nomic Embed Text - Gyors és hatékony embedding modell',
      size: '~274MB',
      command: 'ollama pull nomic-embed-text'
    },
    {
      name: 'mxbai-embed-large',
      description: 'MixedBread Embed Large - Nagy pontosságú embedding',
      size: '~670MB',
      command: 'ollama pull mxbai-embed-large'
    },
    {
      name: 'all-minilm',
      description: 'All-MiniLM - Könnyű, gyors embedding modell',
      size: '~45MB',
      command: 'ollama pull all-minilm'
    }
  ]
};

export {
  chatCompletion,
  describeImage,
  createEmbedding,
  createEmbeddingsBatch,
  isOllamaAvailable,
  isModelAvailable,
  getOpenAI,
  OLLAMA_BASE_URL,
  LOCAL_CHAT_MODEL,
  LOCAL_VISION_MODEL,
  LOCAL_EMBEDDING_MODEL,
  OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDING_MODEL
};
