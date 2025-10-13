import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const KEY_FILE = process.env.KEY_STORE || './data/keys.json';
const SERVER_SECRET = process.env.SERVER_SECRET;
if (!SERVER_SECRET) {
  console.error('[FATAL] SERVER_SECRET ausente no .env');
  process.exit(1);
}

const ALGO = 'aes-256-gcm';
const SALT = Buffer.from('synapse-arbitrage-mind-fixed-salt');

function getKey() {
  return crypto.scryptSync(SERVER_SECRET, SALT, 32);
}

function encryptJson(obj) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plain = Buffer.from(JSON.stringify(obj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptJson(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function ensureFile() {
  const dir = path.dirname(KEY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(KEY_FILE)) {
    fs.writeFileSync(KEY_FILE, encryptJson({ users: {} }), 'utf8');
  }
}

export function loadStore() {
  ensureFile();
  const raw = fs.readFileSync(KEY_FILE, 'utf8');
  return decryptJson(raw);
}

export function saveStore(store) {
  ensureFile();
  fs.writeFileSync(KEY_FILE, encryptJson(store), 'utf8');
}

export function upsertUserKeys(userId, data) {
  const store = loadStore();
  store.users = store.users || {};
  store.users[userId] = {
    apiKey: data.apiKey,
    apiSecret: data.apiSecret,
    mode: data.mode || 'futures',
    testnet: !!data.testnet,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
}

export function removeUserKeys(userId) {
  const store = loadStore();
  const users = store.users || {};
  if (users[userId]) {
    delete users[userId];
    store.users = users;
    saveStore(store);
  }
}

export function getUserKeys(userId) {
  const store = loadStore();
  const users = store.users || {};
  return users[userId] || null;
}

export function getMaskedState(userId) {
  const k = getUserKeys(userId);
  if (!k) {
    return {
      configured: false,
      mode: 'futures',
      testnet: false,
      apiKeyMask: '',
      updatedAt: null,
    };
  }
  return {
    configured: true,
    mode: k.mode || 'futures',
    testnet: Boolean(k.testnet),
    apiKeyMask: k.apiKey ? `${k.apiKey.slice(0, 6)}***${k.apiKey.slice(-4)}` : '',
    updatedAt: k.updatedAt ?? null,
  };
}
