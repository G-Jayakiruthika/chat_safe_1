'use strict';

const { createServer } = require('./src/app');
const { createGeminiClient } = require('./src/gemini');
const { createDb } = require('./src/db');

const port = Number(process.env.PORT) || 8080;
const gemini = createGeminiClient({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
});

// Accounts are optional: if node:sqlite is missing, the app still runs without them.
let db = null;
try {
  db = createDb();
} catch (err) {
  console.warn('Accounts disabled —', err.message);
}

const server = createServer({ gemini, env: process.env, db });
server.listen(port, () => {
  console.log(`Chat_Safe × Urimai listening on :${port} (AI ${gemini.enabled ? `on: ${gemini.model}` : 'off'}, accounts ${db ? 'on' : 'off'})`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
