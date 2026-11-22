/**
 * 👑 WHATSAPP SUPER BOT PRO - ULTRA SLIM & FAST EDITION
 * 👤 Owner: Kaleem Khan (923267004137)
 * ⚡ 0ms Latency | Instant Response | Strict Owner Security
 * 🕌 Islamic Suite: .naat, .islamicdate, .namaz, .ayat, .hadith
 * 🗑️ Recovery & Media: .deleterecovery, .view
 * 🎵 Music & Utilities: .aujla, .weather, .crypto
 * ⚙️ System: .react, .ping, .menu
 */

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { funMemes } from './funData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- 🔒 SINGLE-INSTANCE PROCESS GUARD ----------------
const LOCK_FILE = path.resolve(__dirname, 'bot.lock');
function enforceSingleInstance() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const prevPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8').trim(), 10);
      if (prevPid && prevPid !== process.pid) {
        try {
          process.kill(prevPid, 'SIGKILL');
          console.log(`🔒 Terminated previous orphaned bot process (PID: ${prevPid})`);
        } catch (e) {}
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
  } catch (err) {}
}
enforceSingleInstance();

process.on('SIGTERM', () => {
  console.log('🛑 [SIGTERM] Closing WhatsApp connection gracefully...');
  try { sock?.ws?.close(); } catch (e) {}
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('🛑 [SIGINT] Closing WhatsApp connection gracefully...');
  try { sock?.ws?.close(); } catch (e) {}
  process.exit(0);
});
process.on('exit', () => {
  try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch (e) {}
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ [PROCESS ERROR] Uncaught Exception:', err?.message || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [PROCESS ERROR] Unhandled Rejection:', reason?.message || reason);
});

// ---------------- GLOBAL SETTINGS & PERSISTENCE ----------------
const SETTINGS_FILE = path.resolve(__dirname, 'settings.json');

function loadPersistentSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (typeof data.autoReact === 'boolean') config.autoReact = data.autoReact;
      if (typeof data.reactInGroups === 'boolean') config.reactInGroups = data.reactInGroups;
      if (typeof data.reactInPrivate === 'boolean') config.reactInPrivate = data.reactInPrivate;
      if (typeof data.reactToOwnMessages === 'boolean') config.reactToOwnMessages = data.reactToOwnMessages;
      if (typeof data.antiDeleteAuto === 'boolean') config.antiDeleteAuto = data.antiDeleteAuto;
      if (typeof data.viewOnceAuto === 'boolean') config.viewOnceAuto = data.viewOnceAuto;
      if (typeof data.ownerOnlyCommands === 'boolean') config.ownerOnlyCommands = data.ownerOnlyCommands;
      if (typeof data.aiAutoReply === 'boolean') config.aiAutoReply = data.aiAutoReply;
      if (data.aiMode === 'all' || data.aiMode === 'specific') config.aiMode = data.aiMode;
      if (Array.isArray(data.aiAllowedUsers)) config.aiAllowedUsers = data.aiAllowedUsers;
      console.log('💾 Loaded saved settings from settings.json (AI Mode:', config.aiMode, '| React:', config.autoReact, '| Anti-Delete Auto:', config.antiDeleteAuto, ')');
    }
  } catch (err) {
    console.error('Error loading settings.json:', err.message);
  }
}

function savePersistentSettings() {
  try {
    const toSave = {
      autoReact: config.autoReact,
      reactInGroups: config.reactInGroups ?? true,
      reactInPrivate: config.reactInPrivate ?? true,
      reactToOwnMessages: config.reactToOwnMessages ?? false,
      antiDeleteAuto: config.antiDeleteAuto ?? false,
      viewOnceAuto: config.viewOnceAuto ?? false,
      ownerOnlyCommands: config.ownerOnlyCommands,
      aiAutoReply: config.aiAutoReply,
      aiMode: config.aiMode || 'specific',
      aiAllowedUsers: config.aiAllowedUsers || []
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving settings.json:', err.message);
  }
}

loadPersistentSettings();

// ---------------- ⚠️ UNAUTHORIZED USER WARNING & AUTO-BLOCK STORE ----------------
const WARNINGS_FILE = path.resolve(__dirname, 'user_warnings.json');
const userWarningCounts = new Map(); // Key: senderDigits -> count

function loadUserWarnings() {
  try {
    if (fs.existsSync(WARNINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        userWarningCounts.set(k, v);
      }
    }
  } catch (e) {}
}

function saveUserWarnings() {
  try {
    const obj = {};
    for (const [k, v] of userWarningCounts.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(WARNINGS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {}
}

loadUserWarnings();

// ---------------- 🧠 AI CHAT & HUMAN-LIKE AUTO REPLY ENGINE (OPENROUTER) ----------------
const aiChatHistoryMap = new Map(); // Key: remoteJid -> Array of { role, content }

function cleanOldAiHistory() {
  if (aiChatHistoryMap.size > 2000) {
    const keys = Array.from(aiChatHistoryMap.keys()).slice(0, 500);
    for (const k of keys) aiChatHistoryMap.delete(k);
  }
}
setInterval(cleanOldAiHistory, 300000);

async function askOpenRouterAI(prompt, remoteJid = '_global_', pushName = 'Friend') {
  if (!prompt || !prompt.trim()) return null;
  const apiKey = config.openRouterKey;
  if (!apiKey) return null;

  if (!aiChatHistoryMap.has(remoteJid)) {
    aiChatHistoryMap.set(remoteJid, []);
  }
  const history = aiChatHistoryMap.get(remoteJid);

  const systemPrompt = `You are a friendly, witty, extremely helpful, and natural human-like AI companion named "Kaleem AI" (k4_kaleem) on WhatsApp, created by Kaleem Khan (923267004137).
User's Name: ${pushName}

Key Behavior & Personality Rules:
1. Speak naturally like a real person on WhatsApp (friendly, warm, and engaging).
2. Match the user's language: If the user talks in Roman Urdu (e.g., "kese ho bhai", "kya haal hai"), reply in fluent, natural Pakistani Roman Urdu. If they ask in English, reply in English. If in Urdu script, reply in Urdu script.
3. Be concise and conversational (1 to 3 paragraphs max) unless they specifically ask for code, recipes, or long explanations.
4. Use suitable WhatsApp emojis (😊, 💡, 🔥, 🚀, ✨) to make conversations lively.
5. You have full knowledge of coding, general knowledge, jokes, advice, science, business ideas, poetry/shayeri, and life tips.
6. If asked who created you or who owns this bot, proudly mention Kaleem Khan (Owner: 923267004137).`;

  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6),
    { role: 'user', content: prompt }
  ];

  const modelsToTry = [
    config.aiModel || 'meta-llama/llama-3.3-70b-instruct',
    'openai/gpt-4o-mini',
    'meta-llama/llama-3.1-8b-instruct'
  ];

  for (const model of modelsToTry) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://whatsapp-bot.pro',
          'X-Title': 'WhatsApp Super Bot Pro',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: messagesPayload,
          max_tokens: 800,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices && data.choices[0]?.message?.content) {
          const replyText = data.choices[0].message.content.trim();
          history.push({ role: 'user', content: prompt });
          history.push({ role: 'assistant', content: replyText });
          if (history.length > 10) history.splice(0, 2);
          return replyText;
        }
      }
    } catch (err) {
      console.error(`[AI Engine Error on ${model}]:`, err.message);
    }
  }

  return null;
}

const app = express();
const PORT = process.env.PORT || config.port || 3000;

app.enable('trust proxy');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let sock = null;
let currentQrDataUrl = null;
let currentQrRaw = null;
let connectionStatus = 'Starting bot...';
let connectedUser = null;
const botStartTime = Date.now();

// ---------------- ⚡ IN-MEMORY RAM AUDIO CACHE (0ms LATENCY) ----------------
const audioCache = new Map();

// 🚀 Pre-warm RAM Cache for Viral Meme audio clips at startup (0ms light speed)
try {
  for (const m of funMemes) {
    if (m.filePath && fs.existsSync(m.filePath)) {
      const b = fs.readFileSync(m.filePath);
      audioCache.set(m.filePath, b);
      if (m.url) audioCache.set(m.url, b);
    }
  }
} catch (preWarmErr) {}

async function getCachedAudioBuffer(urlOrPath) {
  if (!urlOrPath) return null;
  if (audioCache.has(urlOrPath)) {
    return audioCache.get(urlOrPath);
  }

  // 1. Check if it's a local file on disk
  if (typeof urlOrPath === 'string' && fs.existsSync(urlOrPath)) {
    try {
      const buf = fs.readFileSync(urlOrPath);
      audioCache.set(urlOrPath, buf);
      return buf;
    } catch (e) {
      console.error('[Local Audio Read Error]:', e.message);
    }
  }

  // 2. Otherwise fetch from remote URL
  try {
    const res = await fetch(urlOrPath, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    audioCache.set(urlOrPath, buf);
    return buf;
  } catch (e) {
    throw e;
  }
}

// ---------------- 🎵 UNIVERSAL MUSIC & AUDIO SEARCH ENGINE (APPLE ITUNES 100M+ CDN) ----------------
async function searchAppleMusicUniversal(term, category = 'naat') {
  if (!term) return null;
  const searchQueries = [
    term,
    term + (category === 'naat' ? ' Naat' : ''),
    term + (category === 'naat' ? ' Urdu Naat' : ''),
    (category === 'aujla' ? 'Karan Aujla ' + term : term)
  ];

  for (const q of searchQueries) {
    try {
      const res = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&entity=song&limit=5', {
        signal: AbortSignal.timeout(3000)
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        for (const r of data.results) {
          if (r.previewUrl) {
            return {
              name: r.trackName,
              artist: r.artistName,
              album: r.collectionName || (category === 'naat' ? 'Urdu Naats' : 'Punjabi Hits'),
              url: r.previewUrl,
              duration: '~1 Minute Audio'
            };
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

// Helper: Safely Send Audio Message with Buffer or Fallback Direct URL
async function sendAudioSafe(remoteJid, audioUrlOrPath, fileName = 'audio.mp3', quotedMsg = null) {
  const isMp3 = String(audioUrlOrPath).toLowerCase().includes('.mp3') || fileName.endsWith('.mp3');
  const mime = isMp3 ? 'audio/mpeg' : 'audio/mp4';

  try {
    const audioBuf = await getCachedAudioBuffer(audioUrlOrPath);
    if (audioBuf && audioBuf.length > 0) {
      await sock.sendMessage(
        remoteJid,
        {
          audio: audioBuf,
          mimetype: mime,
          fileName,
          ptt: false
        },
        quotedMsg ? { quoted: quotedMsg } : undefined
      );
      return;
    }
  } catch (bufErr) {
    console.error('Audio buffer fetch error, trying direct URL dispatch:', bufErr.message);
  }

  // Graceful fallback to direct URL dispatch if http
  if (typeof audioUrlOrPath === 'string' && audioUrlOrPath.startsWith('http')) {
    await sock.sendMessage(
      remoteJid,
      {
        audio: { url: audioUrlOrPath },
        mimetype: mime,
        fileName,
        ptt: false
      },
      quotedMsg ? { quoted: quotedMsg } : undefined
    );
  }
}

// ---------------- 👁️ VIEW-ONCE STORAGE & AUTO-REVEAL SYSTEM ----------------
const MEDIA_CACHE_DIR = path.resolve(__dirname, 'media_cache');
if (!fs.existsSync(MEDIA_CACHE_DIR)) {
  fs.mkdirSync(MEDIA_CACHE_DIR, { recursive: true });
}
const VO_STORE_FILE = path.join(MEDIA_CACHE_DIR, 'view_once_store.json');

const lastViewOnceMap = new Map(); // Legacy compatibility & instant lookup: JID/ID -> latest VO entry
const viewOnceByChat = new Map();  // JID/cleanChat -> Array of VO entries (up to 50)
const viewOnceHistory = [];        // Global array of VO entries (up to 100)

function persistViewOnceToDisk() {
  try {
    const list = viewOnceHistory.slice(0, 100).map(e => ({
      id: e.id,
      remoteJid: e.remoteJid,
      participant: e.participant,
      cleanPart: e.cleanPart,
      cleanChat: e.cleanChat,
      pushName: e.pushName,
      timestamp: e.timestamp,
      text: e.text,
      mediaType: e.mediaType,
      mimetype: e.mimetype,
      caption: e.caption,
      fileName: e.fileName,
      ptt: e.ptt,
      isViewOnce: true,
      bufferFile: e.bufferFile || null
    }));
    fs.writeFileSync(VO_STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving view_once_store.json:', err.message);
  }
}

function loadViewOnceFromDisk() {
  try {
    if (!fs.existsSync(VO_STORE_FILE)) return;
    const raw = fs.readFileSync(VO_STORE_FILE, 'utf8');
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return;

    for (const item of items.reverse()) {
      if (!item.mediaType) continue;
      if (item.bufferFile && fs.existsSync(item.bufferFile)) {
        try {
          item.mediaBuffer = fs.readFileSync(item.bufferFile);
        } catch (e) {}
      } else {
        const altFiles = [
          path.join(MEDIA_CACHE_DIR, `${item.id}.jpg`),
          path.join(MEDIA_CACHE_DIR, `${item.id}.mp4`),
          path.join(MEDIA_CACHE_DIR, `${item.id}.mp3`),
          path.join(MEDIA_CACHE_DIR, `${item.id}.bin`)
        ];
        for (const alt of altFiles) {
          if (fs.existsSync(alt)) {
            try {
              item.mediaBuffer = fs.readFileSync(alt);
              item.bufferFile = alt;
              break;
            } catch (e) {}
          }
        }
      }
      saveToViewOnceStore(item, false);
      const storeKey = `${item.remoteJid}:${item.id}`;
      liveMessageStore.set(storeKey, item);
      liveMessageStore.set(item.id, item);
      if (item.cleanChat) liveMessageStore.set(`${item.cleanChat}:${item.id}`, item);
    }
    console.log(`💾 [VIEW-ONCE RESTORED] Loaded ${items.filter(i => i.mediaType).length} cached View-Once records from disk!`);
  } catch (err) {
    console.error('Error loading view_once_store.json:', err.message);
  }
}

function saveToViewOnceStore(entry, shouldPersist = true) {
  if (!entry || !entry.id || !entry.mediaType) return;
  if (entry.text && (entry.text.startsWith('.') || entry.text.startsWith('!') || entry.text.startsWith('/'))) return;
  const remoteJid = entry.remoteJid;
  const cleanChat = extractCleanNumber(remoteJid);
  const cleanPart = extractCleanNumber(entry.participant);

  // 1. Direct key lookups
  lastViewOnceMap.set(entry.id, entry);
  lastViewOnceMap.set(`${remoteJid}:${entry.id}`, entry);
  if (remoteJid) lastViewOnceMap.set(remoteJid, entry);
  if (cleanChat) lastViewOnceMap.set(cleanChat, entry);
  if (cleanPart) lastViewOnceMap.set(cleanPart, entry);

  // 2. Chat history (both raw JID and clean numbers for LID safety)
  const chatKeys = [remoteJid, cleanChat].filter(Boolean);
  for (const k of chatKeys) {
    if (!viewOnceByChat.has(k)) viewOnceByChat.set(k, []);
    const list = viewOnceByChat.get(k);
    const idx = list.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.unshift(entry);
      if (list.length > 50) list.pop();
    }
  }

  // 3. Global history
  const gIdx = viewOnceHistory.findIndex(e => e.id === entry.id);
  if (gIdx >= 0) {
    viewOnceHistory[gIdx] = entry;
  } else {
    viewOnceHistory.unshift(entry);
    if (viewOnceHistory.length > 100) viewOnceHistory.pop();
  }

  // 4. Persist to disk
  if (shouldPersist) {
    persistViewOnceToDisk();
  }
}

async function sendAutoViewOnceToOwner(entry) {
  try {
    if (!entry || !entry.mediaBuffer) return;
    const ownerTarget = '923267004137@s.whatsapp.net';
    const timeStr = new Date(entry.timestamp || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const header = `╔════════════════════════╗\n` +
                   `   🔓 *AUTO VIEW-ONCE UNLOCKED* 🔓\n` +
                   `╚════════════════════════╝\n\n` +
                   `👤 *From:* ${entry.pushName} (@${entry.cleanPart || extractCleanNumber(entry.participant)})\n` +
                   `📍 *Chat:* ${entry.remoteJid?.endsWith('@g.us') ? 'Group Chat' : 'Private Chat'}\n` +
                   `🕒 *Time:* ${timeStr}\n` +
                   (entry.caption ? `📝 *Caption:* ${entry.caption}\n\n` : '\n') +
                   `👑 *Auto-captured by WhatsApp Super Bot Pro*`;
    const mentions = entry.participant ? [entry.participant] : [];

    if (entry.mediaType === 'image') {
      await sock.sendMessage(ownerTarget, { image: entry.mediaBuffer, caption: header, mentions }).catch(() => {});
    } else if (entry.mediaType === 'video') {
      await sock.sendMessage(ownerTarget, { video: entry.mediaBuffer, caption: header, mentions }).catch(() => {});
    } else if (entry.mediaType === 'audio') {
      await sock.sendMessage(ownerTarget, { audio: entry.mediaBuffer, mimetype: entry.mimetype || 'audio/mp4', ptt: true, mentions }).catch(() => {});
    } else if (entry.mediaType === 'document') {
      await sock.sendMessage(ownerTarget, { document: entry.mediaBuffer, mimetype: entry.mimetype || 'application/octet-stream', fileName: entry.fileName || 'unlocked_file', caption: header, mentions }).catch(() => {});
    }
    console.log(`🔓 [AUTO VIEW-ONCE] Forwarded unlocked ${entry.mediaType} to owner`);
  } catch (err) {
    console.error('Error in sendAutoViewOnceToOwner:', err.message);
  }
}

// ---------------- ⚡ REACTED MESSAGES DEDUPLICATION CACHE ----------------
const reactedMessageIds = new Set();

// ---------------- 🗑️ DELETED MESSAGE & MEDIA RECOVERY SYSTEM ----------------
const liveMessageStore = new Map(); // Key: `${remoteJid}:${msgId}`, `${msgId}`, `${cleanChat}:${msgId}` -> message info + buffer
const deletedHistoryMap = new Map(); // Key: `${remoteJid}`, cleanChat, `_global_` -> array of deleted message objects

function cleanOldMessageStore() {
  if (liveMessageStore.size > 5000) {
    const keys = Array.from(liveMessageStore.keys()).slice(0, 1000);
    for (const k of keys) {
      liveMessageStore.delete(k);
    }
  }
}
setInterval(cleanOldMessageStore, 120000);

async function sendAntiDeleteAlert(chatKey, cached) {
  try {
    if (!cached || !sock) return;

    // Send exclusively to Owner's personal chat (923267004137@s.whatsapp.net) - Zero noise in the original chat
    const ownerJid = '923267004137@s.whatsapp.net';
    const cleanPart = extractCleanNumber(cached.participant);
    const cleanChat = extractCleanNumber(chatKey);
    const senderTag = cleanPart ? `@${cleanPart}` : (cached.participant ? `@${cached.participant.split('@')[0]}` : 'User');
    const senderName = cached.pushName || senderTag;
    const isGroup = chatKey && chatKey.endsWith('@g.us');
    const chatLabel = isGroup ? `Group (${chatKey})` : `DM (${cleanChat || chatKey})`;
    const timeStr = cached.timestamp ? new Date(cached.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

    const header = `🗑️ *[DELETED MESSAGE RECOVERED]*\n` +
                   `👤 *From:* ${senderName} (${senderTag})\n` +
                   `📍 *Chat:* ${chatLabel}\n` +
                   (timeStr ? `🕒 *Sent Time:* ${timeStr}\n` : '');

    const mentions = cached.participant ? [cached.participant] : (cleanPart ? [`${cleanPart}@s.whatsapp.net`] : []);

    if (cached.mediaType === 'image' && cached.mediaBuffer) {
      await sock.sendMessage(ownerJid, {
        image: cached.mediaBuffer,
        caption: `${header}${cached.caption ? `\n📝 *Caption:* ${cached.caption}` : ''}`,
        mimetype: cached.mimetype || 'image/jpeg',
        mentions
      }).catch(() => {});
    } else if (cached.mediaType === 'video' && cached.mediaBuffer) {
      await sock.sendMessage(ownerJid, {
        video: cached.mediaBuffer,
        caption: `${header}${cached.caption ? `\n📝 *Caption:* ${cached.caption}` : ''}`,
        mimetype: cached.mimetype || 'video/mp4',
        mentions
      }).catch(() => {});
    } else if (cached.mediaType === 'audio' && cached.mediaBuffer) {
      await sock.sendMessage(ownerJid, {
        text: header,
        mentions
      }).catch(() => {});
      await sock.sendMessage(ownerJid, {
        audio: cached.mediaBuffer,
        mimetype: cached.mimetype || 'audio/mp4',
        ptt: cached.ptt ?? true
      }).catch(() => {});
    } else if (cached.mediaType === 'sticker' && cached.mediaBuffer) {
      await sock.sendMessage(ownerJid, { text: `${header}\n*Sticker:*`, mentions }).catch(() => {});
      await sock.sendMessage(ownerJid, { sticker: cached.mediaBuffer }).catch(() => {});
    } else if (cached.mediaType === 'document' && cached.mediaBuffer) {
      await sock.sendMessage(ownerJid, {
        document: cached.mediaBuffer,
        mimetype: cached.mimetype || 'application/octet-stream',
        fileName: cached.fileName || 'document',
        caption: `${header}${cached.caption ? `\n📝 *Caption:* ${cached.caption}` : ''}`,
        mentions
      }).catch(() => {});
    } else if (cached.text) {
      await sock.sendMessage(ownerJid, {
        text: `${header}\n💬 *Deleted Content:*\n"${cached.text}"`,
        mentions
      }).catch(() => {});
    }

    console.log(`🛡️ [GHOST ANTI-DELETE] Recovered deleted message from ${senderName} in ${chatLabel} sent exclusively to Owner DM`);
  } catch (e) {
    console.error('Error in sendAntiDeleteAlert:', e.message);
  }
}

function handleRevokedMessage(deletedId, targetJid = '', senderJid = '') {
  if (!deletedId) return null;

  let cached = null;
  if (targetJid && liveMessageStore.has(`${targetJid}:${deletedId}`)) {
    cached = liveMessageStore.get(`${targetJid}:${deletedId}`);
  } else if (liveMessageStore.has(deletedId)) {
    cached = liveMessageStore.get(deletedId);
  } else {
    for (const [k, v] of liveMessageStore.entries()) {
      if (v.id === deletedId || k.endsWith(`:${deletedId}`)) {
        cached = v;
        break;
      }
    }
  }

  if (cached) {
    cached.isDeleted = true;
    cached.deletedAt = Date.now();
    const chatKey = (targetJid && targetJid !== '_global_') ? targetJid : (cached.remoteJid || '_global_');
    const cleanChat = extractCleanNumber(chatKey);

    for (const k of [chatKey, cleanChat].filter(Boolean)) {
      if (!deletedHistoryMap.has(k)) {
        deletedHistoryMap.set(k, []);
      }
      const list = deletedHistoryMap.get(k);
      if (!list.some(item => item.id === cached.id)) {
        list.unshift(cached);
        if (list.length > 50) list.pop();
      }
    }

    if (!deletedHistoryMap.has('_global_')) {
      deletedHistoryMap.set('_global_', []);
    }
    const gList = deletedHistoryMap.get('_global_');
    if (!gList.some(item => item.id === cached.id)) {
      gList.unshift(cached);
      if (gList.length > 100) gList.pop();
    }

    console.log(`🗑️ [DELETED MSG CAPTURED] ID: ${deletedId} from ${cached.participant || senderJid} in ${chatKey} (Type: ${cached.mediaType || 'Text'})`);

    // Anti-Delete Shield: if auto-antidelete is enabled, immediately repost the deleted message!
    // (Ignore if owner intentionally deleted his own message)
    const isSenderOwner = cached.participant?.includes('923267004137') || cached.fromMe;
    if (config.antiDeleteAuto && !isSenderOwner) {
      sendAntiDeleteAlert(chatKey, cached).catch(() => {});
    }

    return cached;
  } else {
    console.log(`⚠️ [UNCACHED REVOKE] ID: ${deletedId} was deleted (not found in live cache).`);
  }
  return null;
}

function cacheMessageEntry(remoteJid, msg, trimmedText, unwrapped) {
  if (!msg?.key?.id) return null;
  const msgId = msg.key.id;
  const storeKey = `${remoteJid}:${msgId}`;
  const participant = msg.key.participant || remoteJid;
  const cleanPart = extractCleanNumber(participant);
  const cleanChat = extractCleanNumber(remoteJid);

  const extracted = extractAnyMedia(msg.message);
  const hasMedia = Boolean(extracted && extracted.media && extracted.type);
  const isVO = Boolean(hasMedia && (msg.key?.isViewOnce || isViewOnceMessage(msg.message) || unwrapped?.imageMessage?.viewOnce || unwrapped?.videoMessage?.viewOnce || unwrapped?.audioMessage?.viewOnce));

  const entry = {
    id: msgId,
    remoteJid,
    participant,
    cleanPart,
    cleanChat,
    pushName: msg.pushName || 'Friend',
    timestamp: msg.messageTimestamp ? (Number(msg.messageTimestamp) * 1000) : Date.now(),
    text: trimmedText || extracted?.caption || '',
    mediaType: extracted?.type || null,
    mediaBuffer: null,
    bufferFile: null,
    mediaMessage: extracted?.media || null,
    rawMessage: msg.message,
    mimetype: extracted?.mimetype || null,
    caption: extracted?.caption || null,
    fileName: extracted?.fileName || null,
    ptt: Boolean(extracted?.ptt),
    isViewOnce: isVO,
    isDeleted: false
  };

  // Multiple indices for instant O(1) lookup
  liveMessageStore.set(storeKey, entry);
  liveMessageStore.set(msgId, entry);
  if (cleanChat) liveMessageStore.set(`${cleanChat}:${msgId}`, entry);

  if (entry.isViewOnce) {
    saveToViewOnceStore(entry);
  }

  // Pre-download media buffer immediately so it's ready when requested or deleted
  if (extracted && extracted.media && extracted.type) {
    downloadMedia(extracted.media, extracted.type)
      .then(buf => {
        if (buf && buf.length > 0) {
          entry.mediaBuffer = buf;
          const ext = extracted.type === 'image' ? 'jpg' :
                      extracted.type === 'video' ? 'mp4' :
                      extracted.type === 'audio' ? 'mp3' : 'bin';
          const bufferPath = path.join(MEDIA_CACHE_DIR, `${msgId}.${ext}`);
          try {
            fs.writeFileSync(bufferPath, buf);
            entry.bufferFile = bufferPath;
          } catch (e) {}

          if (entry.isViewOnce) {
            saveToViewOnceStore(entry);
            console.log(`👁️ [VIEW-ONCE ${extracted.type.toUpperCase()} BUFFERED & SAVED] ID: ${msgId} from ${entry.pushName} (${participant})`);
            if (config.viewOnceAuto && !msg.key.fromMe) {
              sendAutoViewOnceToOwner(entry).catch(() => {});
            }
          }
        }
      })
      .catch(err => {
        console.error(`⚠️ [PRE-DOWNLOAD FAILED] ID: ${msgId} (${extracted.type}):`, err?.message || err);
      });
  }

  return entry;
}

// ---------------- MESSAGE UNWRAPPER (EPHEMERAL, VIEW ONCE, BUTTONS) ----------------
function unwrapMessage(rawMessage) {
  if (!rawMessage) return null;
  let m = rawMessage;
  while (
    m?.ephemeralMessage?.message ||
    m?.viewOnceMessage?.message ||
    m?.viewOnceMessageV2?.message ||
    m?.viewOnceMessageV2Extension?.message ||
    m?.documentWithCaptionMessage?.message ||
    m?.editedMessage?.message?.protocolMessage?.editedMessage
  ) {
    m =
      m.ephemeralMessage?.message ||
      m.viewOnceMessage?.message ||
      m.viewOnceMessageV2?.message ||
      m.viewOnceMessageV2Extension?.message ||
      m.documentWithCaptionMessage?.message ||
      m.editedMessage?.message?.protocolMessage?.editedMessage;
  }
  return m;
}

// ---------------- 🔢 PHONE NUMBER & JID DIGIT EXTRACTOR ----------------
function extractCleanNumber(str) {
  if (!str) return '';
  let clean = str.toString().replace(/@.*$/, '').replace(/:.*$/, '').replace(/\D/g, '');
  if (clean.startsWith('03') && clean.length === 11) {
    clean = '92' + clean.slice(1);
  }
  return clean;
}

// ---------------- OWNER NUMBER & PERMISSION VALIDATOR ----------------
function isUserOwner(msg, remoteJid) {
  // 1. If sent from the connected WhatsApp account (fromMe), it's ALWAYS the owner
  if (msg?.key?.fromMe) return true;

  const isGroup = remoteJid && remoteJid.endsWith('@g.us');
  // In groups, NEVER use remoteJid as sender. Use exact participant JID only!
  const senderJid = msg?.key?.participant || msg?.participant || (!isGroup ? remoteJid : '') || '';

  if (!senderJid) return false;

  const senderClean = senderJid.replace(/@.*$/, '').replace(/:.*$/, '').replace(/\D/g, '');
  if (!senderClean || senderClean.length < 5) return false;

  // Exact owner phone numbers for Kaleem Khan ONLY
  const allowedOwners = [
    '923267004137',
    '03267004137',
    '3267004137',
    ...(config.ownerNumbers || []).map(n => n.replace(/\D/g, ''))
  ].filter(Boolean);

  if (allowedOwners.includes(senderClean)) {
    return true;
  }

  // If sender matches the connected bot phone number
  if (sock?.user?.id) {
    const myId = sock.user.id.replace(/@.*$/, '').replace(/:.*$/, '').replace(/\D/g, '');
    if (myId && (senderClean === myId || senderClean.endsWith(myId) || myId.endsWith(senderClean))) {
      return true;
    }
  }

  // If sender matches the connected bot session LID
  if (sock?.user?.lid) {
    const myLid = sock.user.lid.replace(/@.*$/, '').replace(/:.*$/, '').replace(/\D/g, '');
    if (myLid && senderClean === myLid) {
      return true;
    }
  }

  return false;
}

// ---------------- 👥 GROUP ADMIN & OWNER PERMISSION CHECKER ----------------
const groupMetaCache = new Map();
async function getGroupMetadataCached(groupJid) {
  if (!groupJid || !groupJid.endsWith('@g.us')) return null;
  const cached = groupMetaCache.get(groupJid);
  if (cached && (Date.now() - cached.timestamp) < 120000) {
    return cached.data;
  }
  try {
    const meta = await sock.groupMetadata(groupJid);
    if (meta) {
      groupMetaCache.set(groupJid, { data: meta, timestamp: Date.now() });
    }
    return meta;
  } catch (e) {
    return null;
  }
}

async function isUserAdminOrOwner(msg, remoteJid) {
  // 1. Owner always has full command access everywhere
  if (isUserOwner(msg, remoteJid)) return true;

  // 2. In groups, check if sender is an admin / superadmin
  const isGroup = remoteJid && remoteJid.endsWith('@g.us');
  if (isGroup) {
    const senderJid = msg?.key?.participant || msg?.participant || '';
    if (!senderJid) return false;
    const senderClean = senderJid.replace(/@.*$/, '').replace(/:.*$/, '');
    try {
      const meta = await getGroupMetadataCached(remoteJid);
      if (meta && Array.isArray(meta.participants)) {
        const participant = meta.participants.find(p => {
          const pClean = p.id ? p.id.replace(/@.*$/, '').replace(/:.*$/, '') : '';
          return pClean === senderClean || p.id === senderJid;
        });
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
          return true;
        }
      }
    } catch (e) {}
  }

  // Private chats with non-owners, or non-admin group members: return false
  return false;
}

// ---------------- EMOJI REACTION HELPER ----------------
const EMOJIS = ['❤️', '🔥', '⚡', '👑', '✨', '💯', '👌', '🌟', '🚀', '😍', '🌹', '💎', '😎', '🤙'];
function getRandomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function isViewOnceMessage(rawMessage) {
  if (!rawMessage) return false;
  // If the top-level message is plain text or extended text command, it is NEVER a view-once media message
  if (rawMessage.conversation || (rawMessage.extendedTextMessage && !rawMessage.viewOnceMessage && !rawMessage.viewOnceMessageV2)) {
    return false;
  }

  if (
    rawMessage.viewOnceMessage ||
    rawMessage.viewOnceMessageV2 ||
    rawMessage.viewOnceMessageV2Extension ||
    rawMessage.ephemeralMessage?.message?.viewOnceMessage ||
    rawMessage.ephemeralMessage?.message?.viewOnceMessageV2 ||
    rawMessage.ephemeralMessage?.message?.viewOnceMessageV2Extension ||
    rawMessage.documentWithCaptionMessage?.message?.viewOnceMessage ||
    rawMessage.documentWithCaptionMessage?.message?.viewOnceMessageV2
  ) {
    const inner = unwrapMessage(rawMessage);
    if (inner?.imageMessage || inner?.videoMessage || inner?.audioMessage || inner?.documentMessage) {
      return true;
    }
  }

  const unwrapped = unwrapMessage(rawMessage);
  if (
    unwrapped?.imageMessage?.viewOnce ||
    unwrapped?.videoMessage?.viewOnce ||
    unwrapped?.audioMessage?.viewOnce ||
    unwrapped?.documentMessage?.viewOnce
  ) return true;

  return false;
}

function extractAnyMedia(rawMessage) {
  if (!rawMessage) return null;
  const unwrapped = unwrapMessage(rawMessage) || rawMessage;

  if (unwrapped.imageMessage) {
    return {
      type: 'image',
      media: unwrapped.imageMessage,
      caption: unwrapped.imageMessage.caption || '',
      mimetype: unwrapped.imageMessage.mimetype || 'image/jpeg',
      fileName: 'viewonce_photo.jpg',
      isViewOnce: Boolean(isViewOnceMessage(rawMessage) || unwrapped.imageMessage.viewOnce)
    };
  }
  if (unwrapped.videoMessage) {
    return {
      type: 'video',
      media: unwrapped.videoMessage,
      caption: unwrapped.videoMessage.caption || '',
      mimetype: unwrapped.videoMessage.mimetype || 'video/mp4',
      fileName: 'viewonce_video.mp4',
      isViewOnce: Boolean(isViewOnceMessage(rawMessage) || unwrapped.videoMessage.viewOnce)
    };
  }
  if (unwrapped.audioMessage) {
    return {
      type: 'audio',
      media: unwrapped.audioMessage,
      mimetype: unwrapped.audioMessage.mimetype || 'audio/mp4',
      ptt: Boolean(unwrapped.audioMessage.ptt),
      fileName: unwrapped.audioMessage.ptt ? 'voice_note.mp4' : 'audio.mp3',
      isViewOnce: Boolean(isViewOnceMessage(rawMessage) || unwrapped.audioMessage.viewOnce)
    };
  }
  if (unwrapped.stickerMessage) {
    return {
      type: 'sticker',
      media: unwrapped.stickerMessage,
      mimetype: unwrapped.stickerMessage.mimetype || 'image/webp',
      fileName: 'sticker.webp',
      isViewOnce: false
    };
  }
  if (unwrapped.documentMessage) {
    return {
      type: 'document',
      media: unwrapped.documentMessage,
      mimetype: unwrapped.documentMessage.mimetype || 'application/octet-stream',
      fileName: unwrapped.documentMessage.fileName || 'document',
      caption: unwrapped.documentMessage.caption || '',
      isViewOnce: Boolean(isViewOnceMessage(rawMessage) || unwrapped.documentMessage.viewOnce)
    };
  }
  return null;
}

function getContextInfo(rawMessage) {
  if (!rawMessage) return null;
  const unwrapped = unwrapMessage(rawMessage) || rawMessage;
  return (
    unwrapped.extendedTextMessage?.contextInfo ||
    unwrapped.imageMessage?.contextInfo ||
    unwrapped.videoMessage?.contextInfo ||
    unwrapped.audioMessage?.contextInfo ||
    unwrapped.documentMessage?.contextInfo ||
    unwrapped.stickerMessage?.contextInfo ||
    rawMessage.extendedTextMessage?.contextInfo ||
    rawMessage.imageMessage?.contextInfo ||
    rawMessage.videoMessage?.contextInfo ||
    null
  );
}

function extractText(rawMessage) {
  const message = unwrapMessage(rawMessage);
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.templateButtonReplyMessage?.selectedId ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.selectedRowId ||
    ''
  );
}

async function downloadMedia(mediaMessage, type) {
  if (!mediaMessage) return null;
  if (Buffer.isBuffer(mediaMessage)) return mediaMessage;

  // 1. Unwrap nested message structures if a full WAMessage or viewOnce wrapper was passed
  let target = mediaMessage;
  if (target.message) target = target.message;
  target = unwrapMessage(target) || target;

  if (target.imageMessage) { target = target.imageMessage; type = type || 'image'; }
  else if (target.videoMessage) { target = target.videoMessage; type = type || 'video'; }
  else if (target.audioMessage) { target = target.audioMessage; type = type || 'audio'; }
  else if (target.documentMessage) { target = target.documentMessage; type = type || 'document'; }
  else if (target.stickerMessage) { target = target.stickerMessage; type = type || 'sticker'; }

  if (type === 'ptt') type = 'audio';
  if (!type) {
    if (target.mimetype?.startsWith('image/')) type = 'image';
    else if (target.mimetype?.startsWith('video/')) type = 'video';
    else if (target.mimetype?.startsWith('audio/')) type = 'audio';
    else type = 'image';
  }

  // Attempt 1: Direct stream download via downloadContentFromMessage
  try {
    const stream = await downloadContentFromMessage(target, type);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buf = Buffer.concat(chunks);
    if (buf && buf.length > 0) return buf;
  } catch (err1) {
    // Attempt 2: Fallback via downloadMediaMessage with Baileys reupload context
    try {
      const typeKey = type === 'audio' ? 'audioMessage' :
                      type === 'video' ? 'videoMessage' :
                      type === 'sticker' ? 'stickerMessage' :
                      type === 'document' ? 'documentMessage' : 'imageMessage';
      const ctx = sock ? { reuploadRequest: (m) => sock.updateMediaMessage(m) } : undefined;
      const buf = await downloadMediaMessage({ message: { [typeKey]: target } }, 'buffer', {}, ctx);
      if (buf && buf.length > 0) return buf;
    } catch (err2) {
      // Attempt 3: If direct download fails but jpegThumbnail exists (e.g. quoted message preview)
      if (target?.jpegThumbnail && Buffer.isBuffer(target.jpegThumbnail)) {
        return target.jpegThumbnail;
      }
    }
  }

  // Fallback: check for thumbnail
  if (target?.jpegThumbnail && Buffer.isBuffer(target.jpegThumbnail)) {
    return target.jpegThumbnail;
  }

  return null;
}

// ---------------- 🌐 UTILITY APIS ----------------
async function fetchWeather(city) {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const cur = data.current_condition[0];
    return `🌦️ *Weather in ${city.toUpperCase()}:*\n\n` +
      `🌡️ *Temp:* ${cur.temp_C}°C (Feels like: ${cur.FeelsLikeC}°C)\n` +
      `☁️ *Condition:* ${cur.weatherDesc[0].value}\n` +
      `💧 *Humidity:* ${cur.humidity}%\n` +
      `💨 *Wind:* ${cur.windspeedKmph} km/h`;
  } catch (e) {
    return '❌ Shehar ka mausam nahi mil saka. Sahi shehar ka naam likhein (e.g. `.weather Lahore`).';
  }
}

async function fetchCrypto(coin = 'bitcoin') {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether&vs_currencies=usd,pkr', { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    return `🪙 *Live Crypto Prices*:\n\n` +
      `• *Bitcoin (BTC):* $${data.bitcoin.usd.toLocaleString()} | Rs. ${data.bitcoin.pkr.toLocaleString()}\n` +
      `• *Ethereum (ETH):* $${data.ethereum.usd.toLocaleString()} | Rs. ${data.ethereum.pkr.toLocaleString()}\n` +
      `• *Solana (SOL):* $${data.solana.usd.toLocaleString()} | Rs. ${data.solana.pkr.toLocaleString()}\n` +
      `• *USDT:* $${data.tether.usd} | Rs. ${data.tether.pkr.toLocaleString()}`;
  } catch (e) {
    return '❌ Crypto rate fetch nahi ho saka. Dobara try karein.';
  }
}

async function fetchNamaz(city = 'Lahore') {
  try {
    const res = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=Pakistan`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const t = data.data.timings;
    return `🕌 *Prayer Times in ${city.toUpperCase()}* (Pakistan):\n\n` +
      `🌅 *Fajr:* ${t.Fajr}\n` +
      `☀️ *Sunrise:* ${t.Sunrise}\n` +
      `🌞 *Dhuhr:* ${t.Dhuhr}\n` +
      `🌇 *Asr:* ${t.Asr}\n` +
      `🌆 *Maghrib:* ${t.Maghrib}\n` +
      `🌙 *Isha:* ${t.Isha}`;
  } catch (e) {
    return '❌ Namaz ke timings nahi mil sakay. Example: `.namaz Karachi`';
  }
}

// ---------------- 🌐 PRODUCTION MASTER WEB DASHBOARD ----------------
app.get(['/', '/qr', '/pair'], (req, res) => {
  const publicHtml = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicHtml)) {
    return res.sendFile(publicHtml);
  }
  res.send(`<!DOCTYPE html><html><head><title>WhatsApp Super Bot Pro</title></head><body style="background:#111b21;color:#fff;font-family:sans-serif;text-align:center;padding:50px;"><h1>👑 WhatsApp Super Bot Pro</h1><p>Status: ${connectionStatus}</p><p>Owner: Kaleem Khan (923267004137)</p></body></html>`);
});

// ---------------- 🔍 DOMAIN & CLOUD HEALTH CHECK (/health) ----------------
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - botStartTime) / 1000);
  res.json({
    status: 'online',
    bot: config.botName || 'WhatsApp Super Bot Pro',
    owner: 'Kaleem Khan (923267004137)',
    uptime,
    connected: Boolean(connectedUser),
    user: connectedUser ? (connectedUser.id ? connectedUser.id.split(':')[0] : 'Owner') : null,
    memory: {
      heapUsedMb: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
      rssMb: (process.memoryUsage().rss / 1024 / 1024).toFixed(2)
    },
    features: {
      ghostAntiDelete: config.antiDeleteAuto,
      viewOnce: config.viewOnceAuto,
      aiAutoReply: config.aiAutoReply,
      aiMode: config.aiMode,
      autoReact: config.autoReact,
      strictOwner: config.ownerOnlyCommands
    },
    timestamp: new Date().toISOString()
  });
});

// ---------------- 🔢 API: REQUEST PAIRING CODE ----------------
app.get('/pair-code', async (req, res) => {
  const phone = req.query.phone || req.query.number;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number darj karein (e.g. 923267004137)' });
  }

  const cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: 'Sahi WhatsApp number country code ke sath likhein (e.g. 923267004137)' });
  }

  if (sock?.authState?.creds?.registered) {
    return res.json({ success: false, message: 'WhatsApp pehle se connected hai!' });
  }

  try {
    if (!sock) {
      return res.status(503).json({ success: false, error: 'Bot connect ho raha hai, 2 second baad dobara try karein.' });
    }

    console.log(`📱 [PAIRING CODE REQUESTED] For phone number: ${cleanPhone}`);
    const code = await sock.requestPairingCode(cleanPhone);
    let formattedCode = code;
    if (code && code.length === 8 && !code.includes('-')) {
      formattedCode = code.slice(0, 4) + '-' + code.slice(4);
    }
    console.log(`🔑 [PAIRING CODE GENERATED]: ${formattedCode}`);

    return res.json({
      success: true,
      code: formattedCode,
      rawCode: code,
      phone: cleanPhone
    });
  } catch (err) {
    console.error('Pairing code error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Pairing code generate nahi ho saka: ' + (err.message || err)
    });
  }
});

// Direct QR PNG Stream Route
app.get('/qr.png', async (req, res) => {
  try {
    if (currentQrRaw) {
      const pngBuf = await QRCode.toBuffer(currentQrRaw, { width: 400, margin: 2 });
      res.setHeader('Content-Type', 'image/png');
      return res.send(pngBuf);
    } else if (currentQrDataUrl) {
      const base64Data = currentQrDataUrl.replace(/^data:image\/png;base64,/, '');
      const pngBuf = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', 'image/png');
      return res.send(pngBuf);
    }
    res.status(404).send('QR code not ready yet.');
  } catch (e) {
    res.status(500).send('Error generating QR image');
  }
});

// Session Reset API
app.get('/reset-auth', async (req, res) => {
  try {
    console.log('🔄 [AUTH RESET] Purging session files for new QR login...');
    if (sock) {
      try { sock.ev.removeAllListeners(); } catch (e) {}
      try { sock.ws?.close(); } catch (e) {}
    }
    const authDir = path.resolve(__dirname, 'auth_info_baileys');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
    connectedUser = null;
    currentQrDataUrl = null;
    currentQrRaw = null;
    connectionStatus = 'Generating fresh QR Code...';
    isStartingBot = false;
    setTimeout(() => {
      startBot();
    }, 1000);
    res.json({ success: true, message: 'Session reset. Fresh QR code is generating.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/status', (req, res) => {
  const uptime = Math.floor((Date.now() - botStartTime) / 1000);
  res.json({
    status: connectionStatus,
    qr: currentQrDataUrl,
    user: connectedUser,
    uptime,
    antiDelete: config.antiDeleteAuto,
    viewOnce: config.viewOnceAuto,
    ai: config.aiAutoReply,
    aiMode: config.aiMode
  });
});

// ---------------- 🔑 PERMANENT CLOUD SESSION EXPORTER (/api/session) ----------------
app.get(['/api/session', '/session.json'], (req, res) => {
  const authDir = path.resolve(__dirname, 'auth_info_baileys');
  const credsFile = path.join(authDir, 'creds.json');
  if (!fs.existsSync(credsFile)) {
    return res.json({ success: false, message: 'WhatsApp is not connected yet.' });
  }
  try {
    const credsContent = fs.readFileSync(credsFile, 'utf8');
    const base64Session = Buffer.from(credsContent).toString('base64');
    return res.json({ success: true, session: base64Session });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- 🔑 PERMANENT CLOUD SESSION EXPORTER (/session) ----------------
app.get('/session', (req, res) => {
  const authDir = path.resolve(__dirname, 'auth_info_baileys');
  const credsFile = path.join(authDir, 'creds.json');

  if (!fs.existsSync(credsFile)) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - Session Generator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111b21; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; text-align: center; }
          .card { background: #202c33; padding: 30px; border-radius: 14px; max-width: 480px; width: 100%; border: 1px solid #2a3942; }
          a { display: inline-block; margin-top: 15px; color: #00a884; font-weight: bold; text-decoration: none; padding: 10px 20px; background: #182229; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⚠️ Bot Abhi Connected Nahi Hai</h2>
          <p style="color: #8696a0;">Pehle WhatsApp se QR Code scan karein taake login credentials generate ho sakein.</p>
          <a href="/qr">👉 Scan QR Code Here</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const credsContent = fs.readFileSync(credsFile, 'utf8');
    const base64Session = Buffer.from(credsContent).toString('base64');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Render Permanent Session Key</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111b21; color: #e9edef; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 15px; box-sizing: border-box; }
          .card { background: #202c33; padding: 25px; border-radius: 16px; max-width: 580px; width: 100%; border: 1px solid #2a3942; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
          h2 { color: #00a884; margin-top: 0; margin-bottom: 8px; }
          textarea { width: 100%; height: 110px; background: #111b21; color: #25d366; border: 1px solid #2a3942; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 12px; box-sizing: border-box; resize: none; word-break: break-all; }
          .btn { background: #00a884; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; margin-top: 15px; transition: 0.2s; }
          .btn:hover { background: #028e70; }
          .step-box { background: #182229; border-radius: 8px; padding: 15px; margin-top: 18px; text-align: left; font-size: 13px; line-height: 1.6; color: #8696a0; border: 1px solid #2a3942; }
          .step-box b { color: #e9edef; }
          code { background: #111b21; padding: 2px 6px; border-radius: 4px; color: #00a884; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🔑 Permanent Render Session Key</h2>
          <p style="color:#8696a0; font-size:14px; margin-top:0;">Is key ko Render ke Environment Variables mein add karein taake dobara kabhi QR scan na karna paray!</p>
          <textarea id="sessionKey" readonly>${base64Session}</textarea><br>
          <button class="btn" onclick="copySession()">📋 Copy Session Key</button>

          <div class="step-box">
            <b>🚀 Render Par Add Karne Ka Tareeqa (1-Time Setup):</b><br>
            1. <b>Render.com Dashboard</b> par apni Web Service open karein.<br>
            2. Left menu mein <b>Environment</b> tab par click karein.<br>
            3. <b>Add Environment Variable</b> par click karein:<br>
            &nbsp;&nbsp;• <b>Key:</b> <code>SESSION_DATA</code><br>
            &nbsp;&nbsp;• <b>Value:</b> (Upar wali copy ki hui session key paste karein)<br>
            4. <b>Save Changes</b> par click karein!<br><br>
            🎉 <i>Mubarak ho! Is ke baad Render kitni baar bhi restart ya sleep ho, bot khud-ba-khud login rahega aur kabhi QR nahi maangega!</i>
          </div>
        </div>

        <script>
          function copySession() {
            const ta = document.getElementById('sessionKey');
            ta.select();
            navigator.clipboard.writeText(ta.value).then(() => {
              alert('✅ Session Key Copy Ho Gayi! Ab Render -> Environment mein SESSION_DATA ke tor par paste kar dein.');
            }).catch(() => {
              document.execCommand('copy');
              alert('✅ Session Key Copy Ho Gayi!');
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (e) {
    res.status(500).send('Error generating session string: ' + e.message);
  }
});

// ---------------- 🔄 RESTORE SESSION FROM CLOUD ENVIRONMENT VARIABLE ----------------
function restoreSessionFromEnv() {
  const sessionData = process.env.SESSION_DATA || process.env.SESSION_ID;
  if (!sessionData || !sessionData.trim()) return;

  const authDir = path.resolve(__dirname, 'auth_info_baileys');
  const credsFile = path.join(authDir, 'creds.json');

  if (fs.existsSync(credsFile)) return; // Already exists on disk

  try {
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    let parsedContent = null;
    const raw = sessionData.trim();
    if (raw.startsWith('{')) {
      parsedContent = raw;
    } else {
      parsedContent = Buffer.from(raw, 'base64').toString('utf8');
    }

    // Verify it parses as valid JSON
    JSON.parse(parsedContent);
    fs.writeFileSync(credsFile, parsedContent, 'utf8');
    console.log('🎉 [PERMANENT SESSION RESTORED] Loaded credentials from SESSION_DATA env! No QR scan needed.');
  } catch (err) {
    console.error('❌ [SESSION RESTORE ERROR]: Invalid SESSION_DATA format:', err.message);
  }
}

// ---------------- ⚡ 24/7 DOMAIN & CLOUD KEEP-ALIVE AUTO-PINGER ----------------
const keepAliveUrl = process.env.APP_URL || process.env.DOMAIN_URL || process.env.HOST_URL || process.env.RENDER_EXTERNAL_URL;
if (keepAliveUrl) {
  const targetPingUrl = keepAliveUrl.replace(/\/$/, '') + '/health';
  console.log(`⚡ [24/7 DOMAIN KEEP-ALIVE] Auto-pinger active for: ${targetPingUrl}`);
  setInterval(async () => {
    try {
      await fetch(targetPingUrl, { signal: AbortSignal.timeout(10000) });
      console.log(`💓 [DOMAIN KEEP-ALIVE] Pinged ${targetPingUrl} successfully`);
    } catch (e) {}
  }, 5 * 60 * 1000); // Ping every 5 minutes to prevent sleep
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web Dashboard & QR Scanner available on port ${PORT}`);
});

// ---------------- 🤖 BAILEYS WHATSAPP CLIENT INITIALIZATION ----------------
let isStartingBot = false;

async function startBot() {
  if (isStartingBot) return;
  isStartingBot = true;

  try {
    if (sock) {
      try { sock.ev.removeAllListeners(); } catch (e) {}
      try { sock.ws?.close(); } catch (e) {}
    }

    // 1. Restore credentials from SESSION_DATA if running on cloud container
    restoreSessionFromEnv();

    const { state, saveCreds } = await useMultiFileAuthState(path.resolve(__dirname, 'auth_info_baileys'));
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`⚡ Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 25000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 300,
      maxMsgRetryCount: 5,
      getMessage: async (key) => {
        const storeKey = `${key.remoteJid}:${key.id}`;
        const cached = liveMessageStore.get(storeKey) || liveMessageStore.get(key.id);
        if (cached?.rawMessage) return cached.rawMessage;
        if (cached?.mediaType === 'image') return { imageMessage: { caption: cached.caption || '' } };
        if (cached?.mediaType === 'video') return { videoMessage: { caption: cached.caption || '' } };
        if (cached?.mediaType === 'audio') return { audioMessage: { ptt: cached.ptt } };
        if (cached?.text) return { conversation: cached.text };
        return { conversation: '' };
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQrRaw = qr;
        try {
          currentQrDataUrl = await QRCode.toDataURL(qr);
        } catch (e) {
          currentQrDataUrl = null;
        }
        connectionStatus = 'Scan QR Code to Connect';
        console.log('\n📱 --- SCAN QR CODE BELOW OR OPEN http://localhost:' + PORT + ' ---');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'close') {
        isStartingBot = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        connectionStatus = isLoggedOut ? 'Session Expired. Generating fresh QR...' : `Disconnected (${statusCode || 'Unknown'}). Reconnecting...`;
        connectedUser = null;
        currentQrDataUrl = null;
        console.log(`❌ Connection closed. Reason: ${statusCode}.`);

        if (isLoggedOut) {
          console.log('🔄 [401 LOGGED OUT] Purging invalid session to generate fresh QR...');
          try {
            const authDir = path.resolve(__dirname, 'auth_info_baileys');
            if (fs.existsSync(authDir)) {
              fs.rmSync(authDir, { recursive: true, force: true });
            }
          } catch (e) {}
          setTimeout(() => {
            startBot();
          }, 1500);
        } else {
          setTimeout(() => {
            startBot();
          }, 3000);
        }
      } else if (connection === 'open') {
        isStartingBot = false;
        connectionStatus = '🟢 Connected & Active!';
        connectedUser = sock.user;
        currentQrDataUrl = null;
        console.log('✅ WhatsApp Super Bot Pro Connected Successfully!');
        console.log(`👑 Connected Account: ${sock.user?.id?.split(':')[0] || 'User'}`);
        loadViewOnceFromDisk();
      }
    });

    // ---------------- 📩 MESSAGE UPDATE HANDLER (BAILEYS REVOKES) ----------------
    sock.ev.on('messages.update', async (updates) => {
      try {
        for (const update of updates) {
          if (update.update?.message === null || update.update?.protocolMessage) {
            const deletedId = update.key?.id;
            const targetJid = update.key?.remoteJid;
            if (deletedId) {
              handleRevokedMessage(deletedId, targetJid, update.key?.participant);
            }
          }
        }
      } catch (err) {}
    });

    // ---------------- 📩 MESSAGE HANDLER (MESSAGES.UPSERT) ----------------
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        if (type !== 'notify' && type !== 'append') return;

        for (const msg of messages) {
          if (!msg.message) continue;

          const remoteJid = msg.key.remoteJid;
          if (
            !remoteJid ||
            remoteJid === 'status@broadcast' ||
            remoteJid.endsWith('@broadcast') ||
            remoteJid.endsWith('@newsletter')
          ) {
            continue;
          }

          const isGroup = remoteJid.endsWith('@g.us');
          const isFromMe = Boolean(msg.key.fromMe);
          const senderJid = msg.key.participant || msg.participant || (!isGroup ? remoteJid : '') || remoteJid;

          const unwrapped = unwrapMessage(msg.message) || {};
          const text = extractText(msg.message);
          const trimmedText = text.trim();

          // ---------------- 🗑️ 1. DETECT REVOKED / DELETED MESSAGES (PRIORITY #1) ----------------
          const protocolMsg =
            msg.message?.protocolMessage ||
            unwrapped?.protocolMessage ||
            msg.message?.ephemeralMessage?.message?.protocolMessage ||
            msg.message?.viewOnceMessage?.message?.protocolMessage;

          if (protocolMsg && protocolMsg.key?.id) {
            const deletedId = protocolMsg.key.id;
            const targetJid = protocolMsg.key.remoteJid || remoteJid;
            handleRevokedMessage(deletedId, targetJid, protocolMsg.key.participant || msg.key.participant || senderJid);
            continue;
          }

          if (protocolMsg) continue;

          // Ignore reaction notifications, polling updates, and system key distributions
          if (
            unwrapped.reactionMessage ||
            msg.message?.reactionMessage ||
            unwrapped.pollUpdateMessage ||
            msg.message?.pollUpdateMessage ||
            unwrapped.senderKeyDistributionMessage ||
            msg.message?.senderKeyDistributionMessage
          ) {
            continue;
          }

          // ---------------- 💾 2. CACHE INCOMING MESSAGE & MEDIA BUFFER ----------------
          cacheMessageEntry(remoteJid, msg, trimmedText, unwrapped);

          // Ignore synced historical messages older than 3 minutes (180s)
          const msgTime = Number(msg.messageTimestamp || 0);
          if (msgTime > 0) {
            const nowSec = Math.floor(Date.now() / 1000);
            if ((nowSec - msgTime) > 180) continue;
          }

          const isOwner = isUserOwner(msg, remoteJid);
          const hasCommandAccess = await isUserAdminOrOwner(msg, remoteJid);

          if (trimmedText) {
            console.log(`📩 [MSG] From: ${msg.key.participant || remoteJid} | fromMe: ${isFromMe} | isOwner: ${isOwner} | hasAccess: ${hasCommandAccess} | Text: "${trimmedText}"`);
          }

        // ---------------- 🎮 3. COMMAND HANDLING (ADMINS & OWNER ONLY) ----------------
        const validPrefixes = ['.', '!', '/', '#', config.prefix].filter(Boolean);
        let usedPrefix = null;
        for (const p of validPrefixes) {
          if (trimmedText.startsWith(p)) {
            usedPrefix = p;
            break;
          }
        }

        if (usedPrefix) {
          const rawCommand = trimmedText.slice(usedPrefix.length).trim();
          let args = rawCommand.split(/\s+/);
          let command = args[0]?.toLowerCase();
          let param = args[1]?.toLowerCase();
          let query = rawCommand.slice(command?.length || 0).trim();

          // Support .ai@user or .ai@923... syntax directly
          if (command && command.startsWith('ai@')) {
            const afterAt = command.slice(2); // '@...'
            command = 'ai';
            param = afterAt.toLowerCase();
            query = `${afterAt} ${query}`.trim();
          }

          // 🔒 STRICT ADMINS & OWNER ONLY (SILENT GHOST MODE):
          // Non-owners / Non-admins receive ZERO response (Ghost Mode - bot remains 100% silent so no one knows a bot exists)
          if (!hasCommandAccess) {
            console.log(`🔇 [SILENT GHOST IGNORE] Command ignored from unauthorized user: ${msg.key.participant || remoteJid} | Command: "${trimmedText}"`);
            continue;
          }

          // ==========================================
          // 🎨 1. MEDIA & RECOVERY TOOLS
          // ==========================================

          // ==========================================
          // 🎨 1. MEDIA & RECOVERY TOOLS
          // ==========================================

          // .deleterecovery / .deletedrecovery / .antidelete / .deleted / .recovery (Recover Deleted Text, Photos, Videos & Audio)
          if (
            command === 'deleterecovery' ||
            command === 'deletedrecovery' ||
            command === 'antidelete' ||
            command === 'deleted' ||
            command === 'recovery' ||
            command === 'deletedmsg' ||
            command === 'revoked'
          ) {
            // Check for auto-mode toggle: .antidelete on / off or .antidelete auto on / off
            if (param === 'on' || param === '1' || (param === 'auto' && (args[2]?.toLowerCase() === 'on' || !args[2]))) {
              config.antiDeleteAuto = true;
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                {
                  text: `╔════════════════════════════╗\n` +
                        `   🗑️ *AUTO ANTI-DELETE ON* 🗑️\n` +
                        `╚════════════════════════════╝\n\n` +
                        `⚡ *Status:* 🟢 Active\n\n` +
                        `Jab bhi koi chat ya group mein message delete karega, bot usay foran recover kar ke chat mein post kar dega! 👑`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            } else if (param === 'off' || param === '0' || (param === 'auto' && args[2]?.toLowerCase() === 'off')) {
              config.antiDeleteAuto = false;
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                {
                  text: `🔴 *Auto Anti-Delete is now OFF!*\n\n(Aap abhi bhi \`${config.prefix}deleterecovery\` se manually koi bhi deleted msg recover kar sakte hain).`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            }

            try {
              const ctx = getContextInfo(msg.message);
              const quotedStanzaId = ctx?.stanzaId;
              let targetDeleted = null;
              const cleanChat = extractCleanNumber(remoteJid);

              // Priority 1: Check if user quoted a specific message / deleted bubble
              if (quotedStanzaId) {
                targetDeleted =
                  liveMessageStore.get(`${remoteJid}:${quotedStanzaId}`) ||
                  (cleanChat ? liveMessageStore.get(`${cleanChat}:${quotedStanzaId}`) : null) ||
                  liveMessageStore.get(quotedStanzaId);

                if (!targetDeleted) {
                  for (const [k, v] of liveMessageStore.entries()) {
                    if (v.id === quotedStanzaId || k.endsWith(`:${quotedStanzaId}`)) {
                      targetDeleted = v;
                      break;
                    }
                  }
                }
                if (!targetDeleted) {
                  const allDeleted = [
                    ...(deletedHistoryMap.get(remoteJid) || []),
                    ...(cleanChat && deletedHistoryMap.has(cleanChat) ? deletedHistoryMap.get(cleanChat) : []),
                    ...(deletedHistoryMap.get('_global_') || [])
                  ];
                  targetDeleted = allDeleted.find(item => item.id === quotedStanzaId);
                }
              }

              // Priority 2: Check deletedHistoryMap for this chat
              if (!targetDeleted) {
                const chatList = deletedHistoryMap.get(remoteJid) || (cleanChat && deletedHistoryMap.has(cleanChat) ? deletedHistoryMap.get(cleanChat) : null);
                if (chatList && chatList.length > 0) {
                  const indexChoice = parseInt(query.trim(), 10);
                  if (!isNaN(indexChoice) && indexChoice > 0 && indexChoice <= chatList.length) {
                    targetDeleted = chatList[indexChoice - 1];
                  } else {
                    targetDeleted = chatList[0]; // Most recent deleted
                  }
                }
              }

              // Priority 3: Scan liveMessageStore for any message marked isDeleted in this chat
              if (!targetDeleted) {
                const chatDeleted = Array.from(liveMessageStore.values())
                  .filter(e => (e.remoteJid === remoteJid || e.cleanChat === cleanChat) && e.isDeleted)
                  .reverse();
                if (chatDeleted.length > 0) {
                  targetDeleted = chatDeleted[0];
                }
              }

              // Priority 4: Check global deleted history
              if (!targetDeleted && deletedHistoryMap.has('_global_') && deletedHistoryMap.get('_global_').length > 0) {
                targetDeleted = deletedHistoryMap.get('_global_')[0];
              }

              // Priority 5: Fallback to the latest message received from other participant in this chat
              if (!targetDeleted) {
                const recentMsgs = Array.from(liveMessageStore.values())
                  .filter(e => (e.remoteJid === remoteJid || e.cleanChat === cleanChat) && e.id !== msg.key.id)
                  .reverse();
                if (recentMsgs.length > 0) {
                  targetDeleted = recentMsgs[0];
                }
              }

              if (!targetDeleted) {
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `⚠️ *Is chat mein koi deleted message nahi mila!*\n\n` +
                          `👉 *Tips:*\n` +
                          `1. Jo message delete hua ho usko reply (quote) kar ke \`${config.prefix}deleterecovery\` likhein.\n` +
                          `2. Ya kisi ke msg delete karte hi foran \`${config.prefix}deleterecovery\` send karein.\n` +
                          `3. Auto-recover ke liye: \`${config.prefix}antidelete on\` activate karein.`
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              }

              const timeStr = new Date(targetDeleted.timestamp || Date.now()).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              const senderTag = targetDeleted.participant ? `@${extractCleanNumber(targetDeleted.participant)}` : 'User';
              const mentions = targetDeleted.participant ? [targetDeleted.participant] : [];

              // If deleted message was a Photo/Image
              if (targetDeleted.mediaType === 'image') {
                let imgBuf = targetDeleted.mediaBuffer;
                if (!imgBuf && targetDeleted.mediaMessage) {
                  imgBuf = await downloadMedia(targetDeleted.mediaMessage, 'image').catch(() => null);
                }
                if (imgBuf) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      image: imgBuf,
                      caption: `╔════════════════════════╗\n   🗑️ *DELETED PHOTO RECOVERED* 🗑️\n╚════════════════════════╝\n\n` +
                               `👤 *Sender:* ${senderTag} (${targetDeleted.pushName})\n` +
                               `🕒 *Sent Time:* ${timeStr}\n` +
                               (targetDeleted.caption ? `📝 *Caption:* ${targetDeleted.caption}\n\n` : '\n') +
                               `👑 *Recovered by WhatsApp Super Bot Pro*`,
                      mimetype: targetDeleted.mimetype || 'image/jpeg',
                      mentions
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  console.log(`🗑️ Sent recovered deleted image to ${remoteJid}`);
                  continue;
                }
              }

              // If deleted message was a Video
              if (targetDeleted.mediaType === 'video') {
                let vidBuf = targetDeleted.mediaBuffer;
                if (!vidBuf && targetDeleted.mediaMessage) {
                  vidBuf = await downloadMedia(targetDeleted.mediaMessage, 'video').catch(() => null);
                }
                if (vidBuf) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      video: vidBuf,
                      caption: `╔════════════════════════╗\n   🗑️ *DELETED VIDEO RECOVERED* 🗑️\n╚════════════════════════╝\n\n` +
                               `👤 *Sender:* ${senderTag} (${targetDeleted.pushName})\n` +
                               `🕒 *Sent Time:* ${timeStr}\n` +
                               (targetDeleted.caption ? `📝 *Caption:* ${targetDeleted.caption}\n\n` : '\n') +
                               `👑 *Recovered by WhatsApp Super Bot Pro*`,
                      mimetype: targetDeleted.mimetype || 'video/mp4',
                      mentions
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  console.log(`🗑️ Sent recovered deleted video to ${remoteJid}`);
                  continue;
                }
              }

              // If deleted message was an Audio / Voice Note
              if (targetDeleted.mediaType === 'audio') {
                let audBuf = targetDeleted.mediaBuffer;
                if (!audBuf && targetDeleted.mediaMessage) {
                  audBuf = await downloadMedia(targetDeleted.mediaMessage, 'audio').catch(() => null);
                }
                if (audBuf) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      text: `╔════════════════════════╗\n   🗑️ *DELETED AUDIO RECOVERED* 🗑️\n╚════════════════════════╝\n\n` +
                            `👤 *Sender:* ${senderTag} (${targetDeleted.pushName})\n` +
                            `🕒 *Sent Time:* ${timeStr}\n` +
                            `⏳ *Playing recovered voice note below...*`,
                      mentions
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  await sock.sendMessage(
                    remoteJid,
                    {
                      audio: audBuf,
                      mimetype: targetDeleted.mimetype || 'audio/mp4',
                      ptt: targetDeleted.ptt ?? true
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  continue;
                }
              }

              // If deleted message was a Sticker
              if (targetDeleted.mediaType === 'sticker') {
                let stkBuf = targetDeleted.mediaBuffer;
                if (!stkBuf && targetDeleted.mediaMessage) {
                  stkBuf = await downloadMedia(targetDeleted.mediaMessage, 'sticker').catch(() => null);
                }
                if (stkBuf) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      text: `🗑️ *Deleted Sticker from ${senderTag} (${timeStr}):*`,
                      mentions
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  await sock.sendMessage(remoteJid, { sticker: stkBuf }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
                  continue;
                }
              }

              // If deleted message was a Document
              if (targetDeleted.mediaType === 'document') {
                let docBuf = targetDeleted.mediaBuffer;
                if (!docBuf && targetDeleted.mediaMessage) {
                  docBuf = await downloadMedia(targetDeleted.mediaMessage, 'document').catch(() => null);
                }
                if (docBuf) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      document: docBuf,
                      mimetype: targetDeleted.mimetype || 'application/octet-stream',
                      fileName: targetDeleted.fileName || 'recovered_file',
                      caption: `🗑️ *Deleted Document from ${senderTag} (${timeStr})*`,
                      mentions
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  continue;
                }
              }

              // If deleted message was Text
              const deletedText = targetDeleted.text || '(No text content)';
              await sock.sendMessage(
                remoteJid,
                {
                  text: deletedText,
                  mentions
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              console.log(`🗑️ Sent recovered deleted text to ${remoteJid}`);
            } catch (err) {
              console.error('Delete recovery error:', err);
              await sock.sendMessage(remoteJid, { text: `❌ Message recover karne mein masla aya: ${err.message}` }).catch(() => {});
            }
            continue;
          }

          // .view / .viewonce / .vv / .vo / .rvo / .antivo / .reveal / .open (Unlock View Once Media)
          if (
            command === 'view' ||
            command === 'viewonce' ||
            command === 'vv' ||
            command === 'vo' ||
            command === 'rvo' ||
            command === 'antivo' ||
            command === 'reveal' ||
            command === 'open' ||
            command === 'unlock'
          ) {
            // Check for auto-mode toggle: .viewonce auto on / off
            if (param === 'auto' || param === 'on' || param === 'off') {
              const isTurnOn = param === 'on' || (param === 'auto' && (args[2]?.toLowerCase() === 'on' || !args[2]));
              const isTurnOff = param === 'off' || (param === 'auto' && args[2]?.toLowerCase() === 'off');

              if (isTurnOn) {
                config.viewOnceAuto = true;
                savePersistentSettings();
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `╔════════════════════════════╗\n` +
                          `   🔓 *AUTO VIEW-ONCE ON* 🔓\n` +
                          `╚════════════════════════════╝\n\n` +
                          `⚡ *Status:* 🟢 Active\n\n` +
                          `Jab bhi kisi chat ya group mein koi View Once photo/video send karega, bot usay automatically unmask kar ke Owner ke DM mein bhej dega! 👑`
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              } else if (isTurnOff) {
                config.viewOnceAuto = false;
                savePersistentSettings();
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `🔴 *Auto View-Once is now OFF!*\n\n(Aap abhi bhi \`${config.prefix}view\` ya \`${config.prefix}vo\` se manually View Once photos/videos unlock kar sakte hain).`
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              }
            }

            try {
              const ctx = getContextInfo(msg.message);
              const quotedStanzaId = ctx?.stanzaId;
              const quotedMsg = ctx?.quotedMessage;
              const cleanChat = extractCleanNumber(remoteJid);

              let targetVo = null;

              // Priority 1: Check quoted message ID directly against disk media cache
              if (quotedStanzaId) {
                const directFile = [
                  path.join(MEDIA_CACHE_DIR, `${quotedStanzaId}.jpg`),
                  path.join(MEDIA_CACHE_DIR, `${quotedStanzaId}.mp4`),
                  path.join(MEDIA_CACHE_DIR, `${quotedStanzaId}.mp3`),
                  path.join(MEDIA_CACHE_DIR, `${quotedStanzaId}.bin`)
                ].find(f => fs.existsSync(f));

                if (directFile) {
                  const ext = path.extname(directFile).toLowerCase();
                  const mType = (ext === '.jpg' || ext === '.jpeg') ? 'image' : (ext === '.mp4') ? 'video' : 'audio';
                  targetVo = {
                    id: quotedStanzaId,
                    remoteJid,
                    mediaType: mType,
                    mediaBuffer: fs.readFileSync(directFile),
                    bufferFile: directFile
                  };
                }
              }

              // Priority 2: Check quoted message ID across memory indices
              if (!targetVo && quotedStanzaId) {
                const candidate =
                  viewOnceHistory.find(e => e.id === quotedStanzaId && e.mediaType) ||
                  (viewOnceByChat.has(remoteJid) ? viewOnceByChat.get(remoteJid).find(e => e.id === quotedStanzaId && e.mediaType) : null) ||
                  (cleanChat && viewOnceByChat.has(cleanChat) ? viewOnceByChat.get(cleanChat).find(e => e.id === quotedStanzaId && e.mediaType) : null) ||
                  liveMessageStore.get(`${remoteJid}:${quotedStanzaId}`) ||
                  (cleanChat ? liveMessageStore.get(`${cleanChat}:${quotedStanzaId}`) : null) ||
                  liveMessageStore.get(quotedStanzaId) ||
                  lastViewOnceMap.get(quotedStanzaId);

                if (candidate && candidate.mediaType) {
                  targetVo = candidate;
                }

                if (!targetVo) {
                  for (const [k, v] of liveMessageStore.entries()) {
                    if ((v.id === quotedStanzaId || k.endsWith(`:${quotedStanzaId}`)) && v.mediaType) {
                      targetVo = v;
                      break;
                    }
                  }
                }
              }

              // Priority 3: Check viewOnceByChat for this chat (only valid media entries)
              if (!targetVo) {
                const chatList = (viewOnceByChat.get(remoteJid) || (cleanChat && viewOnceByChat.get(cleanChat)) || []).filter(e => e && e.mediaType);
                if (chatList.length > 0) {
                  targetVo = chatList[0];
                }
              }

              // Priority 4: Check lastViewOnceMap (only valid media entries)
              if (!targetVo) {
                const cand = lastViewOnceMap.get(remoteJid) || (cleanChat ? lastViewOnceMap.get(cleanChat) : null);
                if (cand && cand.mediaType) {
                  targetVo = cand;
                }
              }

              // Priority 5: Search recent liveMessageStore for any media in this chat
              if (!targetVo) {
                const chatEntries = Array.from(liveMessageStore.values())
                  .filter(e => (e.remoteJid === remoteJid || e.cleanChat === cleanChat) && e.mediaType && (e.isViewOnce || e.mediaBuffer || e.mediaMessage))
                  .reverse();
                const voOnly = chatEntries.filter(e => e.isViewOnce && e.mediaType);
                if (voOnly.length > 0) targetVo = voOnly[0];
                else if (chatEntries.length > 0) targetVo = chatEntries[0];
              }

              // Priority 6: Fallback to global viewOnceHistory
              if (!targetVo && viewOnceHistory.length > 0) {
                targetVo = viewOnceHistory.find(e => e && e.mediaType) || null;
              }

              // Priority 7: Fallback to most recent media file in MEDIA_CACHE_DIR
              if (!targetVo) {
                try {
                  const cachedMediaFiles = fs.readdirSync(MEDIA_CACHE_DIR)
                    .filter(f => !f.endsWith('.json'))
                    .map(f => ({ name: f, time: fs.statSync(path.join(MEDIA_CACHE_DIR, f)).mtimeMs }))
                    .sort((a, b) => b.time - a.time);
                  if (cachedMediaFiles.length > 0) {
                    const newest = cachedMediaFiles[0].name;
                    const ext = path.extname(newest).toLowerCase();
                    const full = path.join(MEDIA_CACHE_DIR, newest);
                    const mType = (ext === '.jpg' || ext === '.jpeg') ? 'image' : (ext === '.mp4') ? 'video' : 'audio';
                    targetVo = {
                      id: newest.split('.')[0],
                      remoteJid,
                      mediaType: mType,
                      mediaBuffer: fs.readFileSync(full),
                      bufferFile: full
                    };
                  }
                } catch (e) {}
              }

              // Priority 8: Extract directly from quotedMsg payload if present
              if (!targetVo && quotedMsg) {
                const extracted = extractAnyMedia(quotedMsg);
                if (extracted && extracted.media && extracted.type) {
                  targetVo = {
                    id: quotedStanzaId,
                    remoteJid,
                    mediaType: extracted.type,
                    mediaMessage: extracted.media,
                    caption: extracted.caption || '',
                    mimetype: extracted.mimetype,
                    fileName: extracted.fileName,
                    ptt: extracted.ptt
                  };
                }
              }

              if (!targetVo) {
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `⚠️ *Koi View Once media nahi mila!*\n\n` +
                          `👉 *Tareeqay:*\n` +
                          `1. View Once photo, video ya voice note ko reply (quote) kar ke \`${config.prefix}view\` ya \`${config.prefix}vo\` likhein.\n` +
                          `2. Ya jab kisi ka View Once msg aye tou foran \`${config.prefix}view\` bhej dein.\n` +
                          `3. Auto-unlock ke liye: \`${config.prefix}viewonce auto on\` karein!`
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              }

              let mediaBuffer = targetVo.mediaBuffer;
              if (!mediaBuffer && targetVo.bufferFile && fs.existsSync(targetVo.bufferFile)) {
                try { mediaBuffer = fs.readFileSync(targetVo.bufferFile); } catch (e) {}
              }

              if (!mediaBuffer && targetVo.id) {
                const possibleFiles = [
                  path.join(MEDIA_CACHE_DIR, `${targetVo.id}.jpg`),
                  path.join(MEDIA_CACHE_DIR, `${targetVo.id}.mp4`),
                  path.join(MEDIA_CACHE_DIR, `${targetVo.id}.mp3`),
                  path.join(MEDIA_CACHE_DIR, `${targetVo.id}.bin`)
                ];
                for (const pf of possibleFiles) {
                  if (fs.existsSync(pf)) {
                    try { mediaBuffer = fs.readFileSync(pf); break; } catch (e) {}
                  }
                }
              }

              if (!mediaBuffer && targetVo.mediaMessage && targetVo.mediaType) {
                mediaBuffer = await downloadMedia(targetVo.mediaMessage, targetVo.mediaType).catch(() => null);
              }

              if (!mediaBuffer && targetVo.rawMessage) {
                mediaBuffer = await downloadMedia(targetVo.rawMessage, targetVo.mediaType).catch(() => null);
              }

              if (!mediaBuffer && quotedMsg) {
                mediaBuffer = await downloadMedia(quotedMsg, targetVo.mediaType).catch(() => null);
              }

              const targetSender = targetVo.pushName ? `${targetVo.pushName} (@${extractCleanNumber(targetVo.participant)})` : (targetVo.participant ? `@${extractCleanNumber(targetVo.participant)}` : 'User');
              const mentions = targetVo.participant ? [targetVo.participant] : [];

              if (!mediaBuffer) {
                // Check if a low-res thumbnail is available to rescue the user
                const fallbackThumb = targetVo.mediaMessage?.jpegThumbnail ||
                                      quotedMsg?.imageMessage?.jpegThumbnail ||
                                      quotedMsg?.videoMessage?.jpegThumbnail;
                if (fallbackThumb && Buffer.isBuffer(fallbackThumb)) {
                  await sock.sendMessage(
                    remoteJid,
                    {
                      image: fallbackThumb,
                      caption: `🔓 *View Once (Recovered Preview)*\n👤 *From:* ${targetSender}\n\n⚠️ Full HD file WhatsApp server par expire ho chuki hai, lekin Bot ne iski preview image recover kar li hai!`,
                      mentions
                    },
                    isFromMe ? undefined : { quoted: msg }
                  ).catch(() => {});
                  continue;
                }

                await sock.sendMessage(
                  remoteJid,
                  { text: '❌ *Media download nahi ho saka!*\n\nYeh message bot ke connect hone se pehle ka hai jis ki decryption key WhatsApp server se expire ho chuki hai. A ainda aane walay tamam View Once photos aur videos bot foran capture kar ke unlock kar dega!' },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              }

              const headerText = `🔓 *View Once Unlocked*\n👤 *From:* ${targetSender}${targetVo.caption ? `\n📝 ${targetVo.caption}` : ''}`;

              if (targetVo.mediaType === 'image') {
                await sock.sendMessage(
                  remoteJid,
                  {
                    image: mediaBuffer,
                    caption: headerText,
                    mimetype: targetVo.mimetype || 'image/jpeg',
                    mentions
                  },
                  isFromMe ? undefined : { quoted: msg }
                );
                console.log(`🔓 [VIEW ONCE SENT] Unlocked Image sent to ${remoteJid}`);
              } else if (targetVo.mediaType === 'video') {
                await sock.sendMessage(
                  remoteJid,
                  {
                    video: mediaBuffer,
                    caption: headerText,
                    mimetype: targetVo.mimetype || 'video/mp4',
                    mentions
                  },
                  isFromMe ? undefined : { quoted: msg }
                );
                console.log(`🔓 [VIEW ONCE SENT] Unlocked Video sent to ${remoteJid}`);
              } else if (targetVo.mediaType === 'audio') {
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: headerText,
                    mentions
                  },
                  isFromMe ? undefined : { quoted: msg }
                );
                await sock.sendMessage(
                  remoteJid,
                  {
                    audio: mediaBuffer,
                    mimetype: targetVo.mimetype || 'audio/mp4',
                    ptt: targetVo.ptt ?? true
                  },
                  isFromMe ? undefined : { quoted: msg }
                );
                console.log(`🔓 [VIEW ONCE SENT] Unlocked Audio sent to ${remoteJid}`);
              } else if (targetVo.mediaType === 'document') {
                await sock.sendMessage(
                  remoteJid,
                  {
                    document: mediaBuffer,
                    mimetype: targetVo.mimetype || 'application/octet-stream',
                    fileName: targetVo.fileName || 'unlocked_file',
                    caption: headerText,
                    mentions
                  },
                  isFromMe ? undefined : { quoted: msg }
                );
              } else if (targetVo.mediaType === 'sticker') {
                await sock.sendMessage(
                  remoteJid,
                  { sticker: mediaBuffer },
                  isFromMe ? undefined : { quoted: msg }
                );
              }
            } catch (voErr) {
              console.error('View Once unlock error:', voErr);
              await sock.sendMessage(
                remoteJid,
                { text: `❌ View Once download karne mein masla aya: ${voErr.message}` },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
            }
            continue;
          }

          // ==========================================
          // 🕌 2. SMART UTILITIES & ISLAMIC TOOLS
          // ==========================================

          // .weather <city>
          if (command === 'weather' || command === 'mausam') {
            const city = query || 'Lahore';
            const wText = await fetchWeather(city);
            await sock.sendMessage(remoteJid, { text: wText }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
            continue;
          }

          // .crypto / .btc
          if (command === 'crypto' || command === 'btc' || command === 'eth' || command === 'coin') {
            const cText = await fetchCrypto(query || 'bitcoin');
            await sock.sendMessage(remoteJid, { text: cText }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
            continue;
          }

          // .namaz <city>
          if (command === 'namaz' || command === 'prayer' || command === 'adhan') {
            const city = query || 'Lahore';
            const nText = await fetchNamaz(city);
            await sock.sendMessage(remoteJid, { text: nText }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
            continue;
          }

          // .naat / .urdunaat / .naatshareef (Unlimited Popular Urdu Naats ~1 Minute Audio)
          if (command === 'naat' || command === 'urdunaat' || command === 'naatshareef' || command === 'naats') {
            const naatTracks = [
              { key: 'tajdareharam', name: 'Tajdar-E-Haram', artist: 'Atif Aslam', album: 'Coke Studio Season 8', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b9/75/0b/b9750bad-dc50-f831-6a76-1db3ff3a95f3/mzaf_16667428091119990004.plus.aac.p.m4a' },
              { key: 'meradilbadalde', name: 'Mera Dil Badal De', artist: 'Junaid Jamshed', album: 'Jalwa-E-Janan', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b3/ef/11/b3ef11dc-d6f7-bce4-dd39-2a93b455b854/mzaf_15707797746197171492.plus.aac.p.m4a' },
              { key: 'faslonkotakalluf', name: 'Faslon Ko Takalluf Hai Ham Se Agar', artist: 'Qari Waheed Zafar Qasmi', album: 'Best of Naat, Vol. 01', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6d/97/be/6d97bebf-cf9e-250d-f5db-2ad4b2b5bdee/mzaf_4975039300140601369.plus.aac.p.m4a' },
              { key: 'likhrahahoonnaat', name: 'Likh Raha Hoon Naat-E-Sarwar', artist: 'Owais Raza Qadri', album: 'Al Nabi Salloo Aleh', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/6e/d9/e6/6ed9e643-d351-705d-1158-fbac924151db/mzaf_9648266486095285678.plus.aac.p.m4a' },
              { key: 'yarabdilemuslim', name: 'Ya Rab Dil-E-Muslim Ko', artist: 'Mohammad Owais Raza Qadri', album: 'My Favourite Naats', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview60/v4/ae/3b/0c/ae3b0c32-0851-c0c0-915c-245fb4dd8bda/mzaf_8010099709055485301.plus.aac.p.m4a' },
              { key: 'merenabipyarenabi', name: 'Mere Nabi Pyare Nabi', artist: 'Junaid Jamshed', album: 'Best of Junaid Jamshed', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/67/d1/ce/67d1ced6-35a6-65d4-fd4a-83df7ea01802/mzaf_4168465756475949555.plus.aac.p.m4a' },
              { key: 'illahiterichaukhat', name: 'Illahi Teri Chaukhat Par', artist: 'Junaid Jamshed', album: 'Kya Haseen Samaa Hoga', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/5c/e4/3a/5ce43a62-a634-709a-041f-c3f354f68aad/mzaf_7299224649061393797.plus.aac.p.m4a' },
              { key: 'jagahjeelaganeki', name: 'Jagah Jee Lagane Ki', artist: 'Alhajj M. Owais Raza Qadri', album: 'Mah-E-Ramzan Aaya', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/20/af/85/20af85af-4ab8-f889-14ca-08a086e89e41/mzaf_14583614194113150510.plus.aac.p.m4a' },
              { key: 'hasbirabbi', name: 'Hasbi Rabbi Jallallah', artist: 'Sami Yusuf', album: 'My Ummah', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/0e/b0/9f/0eb09f0a-b698-e6e7-2227-82442d2491ff/mzaf_6651501586607752988.plus.aac.p.m4a' },
              { key: 'yanabisalamalayka', name: 'Ya Nabi Salam Alayka', artist: 'Maher Zain', album: 'Thank You Allah', url: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/07/b7/4a/07b74ada-9fc2-1bf5-e106-9f1950ee147c/mzaf_715121258896882606.plus.aac.p.m4a' }
            ];

            let selected = null;
            if (query) {
              const qLower = query.toLowerCase().trim();
              selected = naatTracks.find(t => qLower.includes(t.key) || t.name.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower));

              if (!selected) {
                const searchRes = await searchAppleMusicUniversal(query, 'naat');
                if (searchRes && searchRes.url) {
                  selected = {
                    key: query.replace(/\s+/g, '_'),
                    name: searchRes.name,
                    artist: searchRes.artist,
                    album: searchRes.album,
                    url: searchRes.url
                  };
                }
              }
            }

            if (!selected) {
              selected = naatTracks[Math.floor(Math.random() * naatTracks.length)];
            }

            try {
              await sock.sendMessage(
                remoteJid,
                {
                  text: `🕌 *NAAT-E-RASOOL-E-MAQBOOL (ﷺ)* 🕌\n\n` +
                    `✨ *Naat:* ${selected.name}\n` +
                    `🎙️ *Sana Khawan:* ${selected.artist}\n` +
                    `💿 *Album:* ${selected.album || 'Islamic Naats'}\n` +
                    `⏱️ *Duration:* ~1 Minute High Quality Audio\n\n` +
                    `🤲 *"Balaghal-Ula Bi-Kamaalihi, Kashafad-Duja Bi-Jamaalihi"*\n\n` +
                    `⏳ *Sending playable Naat audio...*`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});

              await sendAudioSafe(remoteJid, selected.url, `${selected.name}.mp3`, isFromMe ? null : msg);
              console.log(`⚡ [NAAT SENT] ${selected.name} to ${remoteJid}`);
            } catch (err) {
              console.error('Naat audio error:', err);
              await sock.sendMessage(remoteJid, { text: '❌ Naat audio fetch karne mein masla aya. Dobara try karein.' }).catch(() => {});
            }
            continue;
          }

          // .ayat (Daily Quranic Ayat Text)
          if (command === 'ayat' || command === 'quranic') {
            const ayatList = [
              '📖 *"Beshak mushkil ke sath aasani hai."* (Surah Ash-Sharh: 5)\n\n✨ Allah par bharosa rakhein!',
              '📖 *"Aur jab mere banday aap se mere baray mein poochein tu keh dein ke main un ke qareeb hoon, jab koi pukaarne wala mujhe pukaarta hai tu main us ki dua qabool karta hoon."* (Surah Al-Baqarah: 186)',
              '📖 *"Allah kisi jaan par us ki taqat se zyada bojh nahi daalta."* (Surah Al-Baqarah: 286)',
              '📖 *"Tumhara Rab farmata hai ke Mujhe pukaro, Main tumhari duaen qabool karoon ga."* (Surah Ghafir: 60)',
              '📖 *"Aur sabr karo, beshak Allah sabr karne walon ke sath hai."* (Surah Al-Anfal: 46)'
            ];
            const randomAyat = ayatList[Math.floor(Math.random() * ayatList.length)];
            await sock.sendMessage(remoteJid, { text: `🕌 *QURAN MAJEED AYAT* 🕌\n\n${randomAyat}` }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
            continue;
          }

          // .hadith (Hadith of the day)
          if (command === 'hadith' || command === 'hadees') {
            const hadithList = [
              '📜 *Rasoolullah (ﷺ) ne farmaya:*\n\n"Tum mein se behtareen shakhs wo hai jo Quran seekhay aur doosron ko sikhaye."\n(Sahih Bukhari: 5027)',
              '📜 *Rasoolullah (ﷺ) ne farmaya:*\n\n"Muskaan bhi sadqah hai."\n(Jami At-Tirmidhi: 1956)',
              '📜 *Rasoolullah (ﷺ) ne farmaya:*\n\n"Pakeezgi aadha imaan hai."\n(Sahih Muslim: 223)',
              '📜 *Rasoolullah (ﷺ) ne farmaya:*\n\n"Dua momin ka hathiyar hai."\n(Al-Mustadrak)',
              '📜 *Rasoolullah (ﷺ) ne farmaya:*\n\n"Jo shakhs logon ka shukriya ada nahi karta, wo Allah ka bhi shukriya ada nahi karta."\n(Sunan Abu Dawood: 4811)'
            ];
            const randomHadith = hadithList[Math.floor(Math.random() * hadithList.length)];
            await sock.sendMessage(remoteJid, { text: `🕌 *SAHIH HADITH* 🕌\n\n${randomHadith}` }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
            continue;
          }

          // .islamicdate / .hijridate / .hijri / .tareekh
          if (command === 'islamicdate' || command === 'hijridate' || command === 'hijri' || command === 'tareekh' || command === 'date') {
            try {
              const res = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Lahore&country=Pakistan', { signal: AbortSignal.timeout(8000) });
              const data = await res.json();
              const h = data.data.date.hijri;
              const g = data.data.date.gregorian;

              const urduMonths = {
                'Muḥarram': 'Muharram-ul-Haram (محرّم الحرام)',
                'Ṣafar': 'Safar-ul-Muzaffar (صفر المظفّر)',
                'Rabīʿ al-awwal': 'Rabi-ul-Awwal (ربیع الاوّل)',
                'Rabīʿ al-thānī': 'Rabi-us-Sani (ربیع الثانی)',
                'Jumādá al-ūlá': 'Jamadi-ul-Awwal (جمادی الاوّل)',
                'Jumādá al-ākhirah': 'Jamadi-us-Sani (جمادی الثانی)',
                'Rajab': 'Rajab-ul-Murajjab (رجب المرجب)',
                'Shaʿbān': 'Shaban-ul-Muazzam (شعبان المعظم)',
                'Ramaḍān': 'Ramadan-ul-Mubarak (رمضان المبارک)',
                'Shawwāl': 'Shawwal-ul-Mukarram (شوّال المکرّم)',
                'Dhū al-Qaʿdah': 'Zil-Qadah (ذوالقعدہ)',
                'Dhū al-Ḥijjah': 'Zil-Hajjah (ذوالحجہ)'
              };

              const urduDays = {
                'Monday': 'Peer (پیر)',
                'Tuesday': 'Mangal (منگل)',
                'Wednesday': 'Budh (بدھ)',
                'Thursday': 'Jumerat (جمعرات)',
                'Friday': 'Jumma (جمعہ)',
                'Saturday': 'Hafta (ہفتہ)',
                'Sunday': 'Itwar (اتوار)'
              };

              const urduMonthName = urduMonths[h.month.en] || `${h.month.en} (${h.month.ar})`;
              const urduDayName = urduDays[g.weekday.en] || g.weekday.en;

              const islamicText = `🕌 *CURRENT ISLAMIC (HIJRI) DATE* 🕌\n\n` +
                `🌙 *Hijri Date:* ${h.day} ${h.month.ar} ${h.year} Hijri\n` +
                `📅 *Islamic Month:* ${urduMonthName}\n` +
                `🗓️ *English Date:* ${g.day} ${g.month.en} ${g.year}\n` +
                `✨ *Day:* ${urduDayName}\n\n` +
                `📖 *"Beshak Allah ke nazdeek maheeno ki ginti 12 hai."* (Surah At-Tawbah: 36)`;

              await sock.sendMessage(remoteJid, { text: islamicText }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
            } catch (err) {
              const intlDate = new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              }).format(new Date());

              await sock.sendMessage(
                remoteJid,
                { text: `🕌 *Current Islamic Date:* ${intlDate}\n📅 *English Date:* ${new Date().toDateString()}` },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
            }
            continue;
          }

          // ==========================================
          // 🎵 3. MUSIC, MEMES & ENTERTAINMENT
          // ==========================================

          // 😂 .fun / .meme / .sound / .soundeffect / .memesound (13 Viral Hindi/Urdu & Global Meme Sounds)
          if (command === 'fun' || command === 'meme' || command === 'sound' || command === 'soundeffect' || command === 'memesound') {
            const requested = query.trim().toLowerCase();

            // 1. Show List only if explicitly requested with .fun list / menu / all
            if (requested === 'list' || requested === 'menu' || requested === 'all') {
              let listText = `╔══════════════════════════════════════╗\n` +
                             `   😂 *VIRAL FUNNY MEME SOUNDS* 😂\n` +
                             `╚══════════════════════════════════════╝\n\n` +
                             `🔊 *13 Popular Urdu/Hindi & Viral Meme Sounds*\n` +
                             `⚡ *Instant Voice Note / Audio Playback (0ms)*\n\n` +
                             `👉 *Direct Play:* Sirf \`${config.prefix}fun\` bhej kar random meme sunein!\n` +
                             `📌 *Specific Meme:* \`${config.prefix}fun <number ya name>\`\n\n` +
                             `┌─── 🎭 *VIRAL MEME LIST* ───\n`;

              funMemes.forEach(m => {
                listText += `│ ${m.id}️⃣ ${m.emoji} • *${m.urduName}* (\`${config.prefix}fun ${m.id}\`)\n`;
              });

              listText += `└─────────────────────────────────────\n\n` +
                          `💡 *Quick Tip:* Type \`${config.prefix}fun aayein\` ya \`${config.prefix}fun violin\` for instant laughs!`;

              await sock.sendMessage(remoteJid, { text: listText }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
              continue;
            }

            // 2. Select Meme (Random by default on ".fun", or by ID/Keyword)
            let selectedMeme = null;
            if (!requested || requested === 'random' || requested === 'rand') {
              selectedMeme = funMemes[Math.floor(Math.random() * funMemes.length)];
            } else {
              const reqNum = parseInt(requested, 10);
              if (!isNaN(reqNum)) {
                selectedMeme = funMemes.find(m => m.id === reqNum);
              }
              if (!selectedMeme) {
                selectedMeme = funMemes.find(m =>
                  m.key === requested ||
                  m.keywords.some(k => requested.includes(k) || k.includes(requested)) ||
                  m.name.toLowerCase().includes(requested) ||
                  m.urduName.includes(requested)
                );
              }
              if (!selectedMeme) {
                selectedMeme = funMemes[Math.floor(Math.random() * funMemes.length)];
              }
            }

            // 3. Send Aesthetic Meme Card & Playable Audio simultaneously (0ms Light Speed)
            try {
              const cardText = `╔══════════════════════════════════════╗\n` +
                               `   😂 *K4_KALEEM FUN MEME SOUND* 😂\n` +
                               `╚══════════════════════════════════════╝\n\n` +
                               `${selectedMeme.emoji} *Meme:* ${selectedMeme.name}\n` +
                               `🎭 *Sound:* ${selectedMeme.urduName}\n` +
                               `⚡ *Speed:* 0ms Instant Play\n\n` +
                               `🔊 *Playing meme sound effect below...* ⬇️`;

              await Promise.allSettled([
                sock.sendMessage(remoteJid, { text: cardText }, isFromMe ? undefined : { quoted: msg }),
                sendAudioSafe(
                  remoteJid,
                  selectedMeme.filePath || selectedMeme.url,
                  `${selectedMeme.key}.mp3`,
                  isFromMe ? null : msg
                )
              ]);

              console.log(`😂 [FUN MEME SENT 0ms] #${selectedMeme.id} (${selectedMeme.name}) to ${remoteJid}`);
            } catch (funErr) {
              console.error('Fun meme error:', funErr);
              await sock.sendMessage(remoteJid, { text: '❌ Meme audio fetch karne mein masla aya.' }).catch(() => {});
            }
            continue;
          }

          // .aujla / .karanaujla / .karan (Karan Aujla Songs Player)
          if (command === 'aujla' || command === 'karanaujla' || command === 'karan' || command === 'song') {
            const aujlaTracks = [
              { key: 'tauba', name: 'Tauba Tauba', album: 'Bad Newz', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010910082444567.mp3' },
              { key: 'winning', name: 'Winning Speech', album: 'Winning Speech', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912112777865.mp3' },
              { key: '52bars', name: '52 Bars', album: 'Four You', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912112777870.mp3' },
              { key: 'whitebrownblack', name: 'White Brown Black', album: 'White Brown Black', singer: 'Karan Aujla, Avvy Sra', url: 'https://jiotunepreview.jio.com/content/Converted/010912291733969.mp3' },
              { key: 'mexico', name: 'Mexico', album: 'Mexico', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912112777890.mp3' },
              { key: 'ontop', name: 'On Top', album: 'On Top', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912112777879.mp3' },
              { key: 'chithiyaan', name: 'Chithiyaan', album: 'Chithiyaan', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912501155242.mp3' },
              { key: 'players', name: 'Players', album: 'Hitlist', singer: 'Badshah, Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912291751461.mp3' },
              { key: 'aujlaszn', name: 'Aujla Szn', album: 'AUJLA SZN 1', singer: 'Karan Aujla', url: 'https://jiotunepreview.jio.com/content/Converted/010912023794176.mp3' },
              { key: 'ashke', name: 'Ashke', album: 'AUJLA SZN 1', singer: 'Karan Aujla, MXRCI', url: 'https://jiotunepreview.jio.com/content/Converted/010912023794174.mp3' }
            ];

            let selected = null;
            if (query) {
              const qLower = query.toLowerCase().trim();
              selected = aujlaTracks.find(t => qLower.includes(t.key) || t.name.toLowerCase().includes(qLower));

              if (!selected) {
                const sRes = await searchAppleMusicUniversal(query, 'aujla');
                if (sRes && sRes.url) {
                  selected = {
                    key: query.replace(/\s+/g, '_'),
                    name: sRes.name,
                    album: sRes.album,
                    singer: sRes.artist,
                    url: sRes.url
                  };
                }
              }
            }

            if (!selected) {
              selected = aujlaTracks[Math.floor(Math.random() * aujlaTracks.length)];
            }

            try {
              await sock.sendMessage(
                remoteJid,
                {
                  text: `🎵 *KARAN AUJLA MUSIC* 🎵\n\n` +
                    `🔥 *Track:* ${selected.name}\n` +
                    `💿 *Album:* ${selected.album || 'Hit Single'}\n` +
                    `🎙️ *Artist:* ${selected.singer || 'Karan Aujla'}\n\n` +
                    `👑 *Geetan Di Machine • Karan Aujla*`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});

              await sendAudioSafe(remoteJid, selected.url, `${selected.name}.mp3`, isFromMe ? null : msg);
              console.log(`⚡ [AUJLA TRACK] Sent ${selected.name} to ${remoteJid}`);
            } catch (err) {
              console.error('Aujla song error:', err);
              await sock.sendMessage(remoteJid, { text: '❌ Karan Aujla track fetch karne mein masla aya.' }).catch(() => {});
            }
            continue;
          }

          // ==========================================
          // ⚙️ 5. BOT SETTINGS & SYSTEM COMMANDS
          // ==========================================

          // 🤖 .ai / .gpt / .ask / .chat / .aion / .aioff / .autoreply (Direct AI Ask & Auto-Reply Toggle)
          if (
            command === 'ai' ||
            command === 'gpt' ||
            command === 'ask' ||
            command === 'chat' ||
            command === 'bot' ||
            command === 'aion' ||
            command === 'aioff' ||
            command === 'autoreply' ||
            command === 'chatgpt'
          ) {
            const ctx = getContextInfo(msg.message);
            const mentionedJids = ctx?.mentionedJid || [];
            const quotedParticipant = ctx?.participant || (msg.message?.extendedTextMessage?.contextInfo?.participant) || null;

            // Check if a specific target user was mentioned, quoted, or written
            let targetUser = null;
            let targetJid = null;

            if (mentionedJids.length > 0) {
              targetJid = mentionedJids[0];
              targetUser = extractCleanNumber(targetJid);
            } else if (quotedParticipant) {
              targetJid = quotedParticipant;
              targetUser = extractCleanNumber(targetJid);
            } else {
              const numMatch = query.match(/@?(\d{9,15})/);
              if (numMatch) {
                targetUser = extractCleanNumber(numMatch[1]);
                targetJid = `${targetUser}@s.whatsapp.net`;
              }
            }

            // Ensure config.aiAllowedUsers is an array
            if (!Array.isArray(config.aiAllowedUsers)) config.aiAllowedUsers = [];

            const isListCmd = param === 'list' || param === 'users' || param === 'status' || query === 'list' || query === 'users';
            const isAllOn = (param === 'all' && (args[2]?.toLowerCase() === 'on' || query.toLowerCase().includes('on'))) ||
                            (param === 'on' && args[2]?.toLowerCase() === 'all') ||
                            (query.toLowerCase() === 'all on' || query.toLowerCase() === 'global on');
            const isAllOff = (param === 'all' && (args[2]?.toLowerCase() === 'off' || query.toLowerCase().includes('off'))) ||
                             (query.toLowerCase() === 'all off' || query.toLowerCase() === 'global off');
            const isRemoveCmd = param === 'remove' || param === 'del' || param === 'delete' ||
                                (param === 'off' && targetUser);

            // 1. List current AI users & mode: .ai list
            if (isListCmd) {
              const activeCount = config.aiAllowedUsers.length;
              let usersListText = '_Koi specific user add nahi hai._';
              if (activeCount > 0) {
                usersListText = config.aiAllowedUsers.map((u, i) => `${i + 1}. @${u}`).join('\n');
              }

              const listMessage = `╔══════════════════════════════════╗\n` +
                                  `   🤖 *AI AUTO-REPLY SETTINGS* 🤖\n` +
                                  `╚══════════════════════════════════╝\n\n` +
                                  `• *Master Status:* ${config.aiAutoReply ? '🟢 Active' : '🔴 Disabled'}\n` +
                                  `• *Current Mode:* ${config.aiMode === 'all' ? '🌐 Everyone (Global Mode)' : '🎯 Specific Users Only'}\n\n` +
                                  `👥 *Selected Users (${activeCount}):*\n` +
                                  `${usersListText}\n\n` +
                                  `👉 *Commands:*\n` +
                                  `• \`${config.prefix}ai @user\` ➔ Specific user ke liye AI on karein\n` +
                                  `• \`${config.prefix}ai remove @user\` ➔ User ko list se hatayein\n` +
                                  `• \`${config.prefix}ai all on\` ➔ Sabhi ke liye on karein (Global)\n` +
                                  `• \`${config.prefix}ai off\` ➔ AI mukammal band karein`;

              await sock.sendMessage(
                remoteJid,
                {
                  text: listMessage,
                  mentions: config.aiAllowedUsers.map(u => `${u}@s.whatsapp.net`)
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            }

            // 2. Turn ON for ALL users (Global Mode): .ai all on
            if (isAllOn) {
              config.aiAutoReply = true;
              config.aiMode = 'all';
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                {
                  text: `🌐 *AI Auto-Reply is now ON for EVERYONE (Global Mode)!*\n\n` +
                        `Bot ab sabhi users ke incoming normal messages ka ChatGPT / Llama 3.3 ki tarah automatic jawab dega. 🤖✨\n\n` +
                        `💡 _Specific users mode ke liye: \`${config.prefix}ai @user\` use karein._`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              console.log(`🤖 [CONFIG UPDATE] AI Auto-Reply set to GLOBAL ALL by ${remoteJid}`);
              continue;
            }

            // 3. Remove a specific user: .ai remove @user / .ai del 923...
            if (isRemoveCmd && targetUser) {
              config.aiAllowedUsers = config.aiAllowedUsers.filter(u => extractCleanNumber(u) !== targetUser);
              savePersistentSettings();

              await sock.sendMessage(
                remoteJid,
                {
                  text: `🔴 *User @${targetUser} AI auto-reply list se remove ho gaya.*\n\n` +
                        `• Baqi active users: ${config.aiAllowedUsers.length}`,
                  mentions: targetJid ? [targetJid] : []
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              console.log(`🤖 [CONFIG UPDATE] Removed ${targetUser} from AI list by ${remoteJid}`);
              continue;
            }

            // 4. Turn OFF completely: .ai off
            const isTurnOff = (param === 'off' || param === '0' || command === 'aioff' || isAllOff) && !targetUser;
            if (isTurnOff) {
              config.aiAutoReply = false;
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                { text: '🔴 *AI Auto-Reply is now OFF!*\n\nBot ab kisi bhi user ke normal message ka automatic AI reply nahi dega. (Direct sawal ke liye `.ai <sawal>` use karein).' },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              console.log(`🤖 [CONFIG UPDATE] AI Auto-Reply turned OFF by ${remoteJid}`);
              continue;
            }

            // 5. Add / Enable for a specific user: .ai @user / .ai 923xxxxxxxxx / .ai add @user
            if (targetUser && (param?.includes('@') || param === 'add' || param === 'on' || /^\d+$/.test(param) || query.includes('@') || quotedParticipant)) {
              if (!config.aiAllowedUsers.includes(targetUser)) {
                config.aiAllowedUsers.push(targetUser);
              }
              config.aiMode = 'specific';
              config.aiAutoReply = true;
              savePersistentSettings();

              const confirmText = `╔══════════════════════════════════╗\n` +
                                  `   🎯 *SPECIFIC AI AUTO-REPLY ON* 🎯\n` +
                                  `╚══════════════════════════════════╝\n\n` +
                                  `👤 *Selected User:* @${targetUser}\n` +
                                  `⚙️ *Mode:* Specific Users Only\n` +
                                  `⚡ *Status:* 🟢 Active\n\n` +
                                  `Ab bot sirf is user (aur baqi selected users) ke messages ka automatic AI reply dega! Kisi aur ko pata bhi nahi chalega. 🤫🤖✨`;

              await sock.sendMessage(
                remoteJid,
                {
                  text: confirmText,
                  mentions: targetJid ? [targetJid] : [`${targetUser}@s.whatsapp.net`]
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              console.log(`🤖 [CONFIG UPDATE] AI enabled for specific user ${targetUser} by ${remoteJid}`);
              continue;
            }

            // 6. Generic .ai on without arguments
            const isTurnOn = param === 'on' || param === '1' || command === 'aion';
            if (isTurnOn) {
              // If sent in a 1-on-1 private chat, enable for this chat!
              if (!isGroup && remoteJid && remoteJid.includes('@s.whatsapp.net')) {
                const thisUser = extractCleanNumber(remoteJid);
                if (thisUser && !config.aiAllowedUsers.includes(thisUser)) {
                  config.aiAllowedUsers.push(thisUser);
                }
                config.aiMode = 'specific';
                config.aiAutoReply = true;
                savePersistentSettings();

                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `🎯 *AI Auto-Reply is now ON for this chat (@${thisUser})!*\n\n` +
                          `Bot ab is chat ke messages ka automatic AI reply dega.\n\n` +
                          `💡 _Sabhi users ke liye on karne ke liye: \`${config.prefix}ai all on\`_`,
                    mentions: [remoteJid]
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                console.log(`🤖 [CONFIG UPDATE] AI enabled for current chat ${thisUser}`);
                continue;
              }

              // In groups or if users already exist
              if (config.aiAllowedUsers.length > 0) {
                config.aiMode = 'specific';
                config.aiAutoReply = true;
                savePersistentSettings();
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `🟢 *AI Auto-Reply is now ON in Specific Users Mode!*\n\n` +
                          `Currently active for *${config.aiAllowedUsers.length} selected user(s)*.\n\n` +
                          `• List dekhne ke liye: \`${config.prefix}ai list\`\n` +
                          `• Sabhi ke liye on karne ke liye: \`${config.prefix}ai all on\``
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              } else {
                config.aiMode = 'all';
                config.aiAutoReply = true;
                savePersistentSettings();
                await sock.sendMessage(
                  remoteJid,
                  {
                    text: `🟢 *AI Auto-Reply is now ON!*\n\n` +
                          `💡 *Tip:* Specific user ke liye on karne ke liye \`${config.prefix}ai @user\` ya \`${config.prefix}ai 0326xxxxxxx\` bhejein.`
                  },
                  isFromMe ? undefined : { quoted: msg }
                ).catch(() => {});
                continue;
              }
            }

            // 7. Check if user sent a direct prompt/question
            let promptQuery = query;
            if (command === 'aion' || command === 'aioff') promptQuery = '';
            if (promptQuery.toLowerCase().startsWith('on') || promptQuery.toLowerCase().startsWith('off') || promptQuery.toLowerCase() === 'list') {
              promptQuery = '';
            }

            if (!promptQuery) {
              await sock.sendMessage(
                remoteJid,
                {
                  text: `╔══════════════════════════════════╗\n` +
                        `   🤖 *KALEEM AI ASSISTANT* 🤖\n` +
                        `╚══════════════════════════════════╝\n\n` +
                        `💡 *Direct Question:* \`${config.prefix}ai <aapka sawal>\`\n` +
                        `📌 *Example:* \`${config.prefix}ai online business idea do\`\n\n` +
                        `🎯 *Specific User Auto-Reply:*\n` +
                        `• \`${config.prefix}ai @user\` ➔ Kisi specific user ke liye AI on karein\n` +
                        `• \`${config.prefix}ai 923xxxxxxxxx\` ➔ Number ke zariye on karein\n` +
                        `• \`${config.prefix}ai remove @user\` ➔ User ko list se hatayein\n` +
                        `• \`${config.prefix}ai list\` ➔ Allowed users ki list dekhein\n\n` +
                        `⚙️ *Global Controls:*\n` +
                        `• \`${config.prefix}ai all on\` ➔ Sabhi ke liye auto-reply ON\n` +
                        `• \`${config.prefix}ai off\` ➔ Auto-reply OFF\n\n` +
                        `⚡ *Status:* ${config.aiAutoReply ? '🟢 Active' : '🔴 Disabled'} | *Mode:* ${config.aiMode === 'all' ? '🌐 Everyone' : '🎯 Specific Users (' + config.aiAllowedUsers.length + ')'}`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            }

            try {
              try { await sock.sendPresenceUpdate('composing', remoteJid); } catch (e) {}
              const aiAnswer = await askOpenRouterAI(promptQuery, remoteJid, msg.pushName || 'Friend');
              try { await sock.sendPresenceUpdate('paused', remoteJid); } catch (e) {}

              if (aiAnswer) {
                await sock.sendMessage(remoteJid, { text: aiAnswer }, isFromMe ? undefined : { quoted: msg });
                console.log(`🤖 [DIRECT AI SENT] Query: "${promptQuery.slice(0, 30)}" to ${remoteJid}`);
              } else {
                await sock.sendMessage(remoteJid, { text: '❌ AI response generate karne mein masla aya. Dobara try karein.' }, isFromMe ? undefined : { quoted: msg });
              }
            } catch (aiErr) {
              console.error('Direct AI error:', aiErr);
              await sock.sendMessage(remoteJid, { text: '❌ AI Error: ' + aiErr.message }, isFromMe ? undefined : { quoted: msg });
            }
            continue;
          }

          // .react on / off / status / group / private / own
          if (command === 'react' || command === 'autoreact') {
            if (param === 'on' || param === '1') {
              config.autoReact = true;
              config.reactInGroups = true;
              config.reactInPrivate = true;
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                {
                  text: `╔════════════════════════════╗\n` +
                        `   ⚡ *AUTO-REACT ACTIVATED* ⚡\n` +
                        `╚════════════════════════════╝\n\n` +
                        `• *Master Status:* 🟢 Active (Instant 0ms Latency)\n` +
                        `• *Private Chats:* 🟢 Enabled\n` +
                        `• *Group Chats:* 🟢 Enabled\n\n` +
                        `Bot ab har naye message par random emojis se reaction dega! 😍🔥✨\n\n` +
                        `💡 _Tip: Apne messages par bhi reaction ke liye: \`${config.prefix}react own on\`_`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            } else if (param === 'off' || param === '0') {
              config.autoReact = false;
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                { text: '🔴 *Auto-React is now OFF!*\n\nBot ab messages par reaction nahi dega.' },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            } else if (param === 'own') {
              const sub = args[2]?.toLowerCase();
              config.reactToOwnMessages = sub === 'on' || sub === '1' || (sub ? false : !config.reactToOwnMessages);
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                { text: `⚡ *React to Own Messages:* ${config.reactToOwnMessages ? '🟢 ON' : '🔴 OFF'}` },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            } else if (param === 'group' || param === 'groups') {
              const sub = args[2]?.toLowerCase();
              config.reactInGroups = sub === 'on' || sub === '1' || (sub ? false : !config.reactInGroups);
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                { text: `⚡ *Auto-React in Groups:* ${config.reactInGroups ? '🟢 ON' : '🔴 OFF'}` },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            } else if (param === 'private' || param === 'dm') {
              const sub = args[2]?.toLowerCase();
              config.reactInPrivate = sub === 'on' || sub === '1' || (sub ? false : !config.reactInPrivate);
              savePersistentSettings();
              await sock.sendMessage(
                remoteJid,
                { text: `⚡ *Auto-React in Private Chats:* ${config.reactInPrivate ? '🟢 ON' : '🔴 OFF'}` },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            } else {
              // Status display
              await sock.sendMessage(
                remoteJid,
                {
                  text: `╔════════════════════════════╗\n` +
                        `   ⚡ *AUTO-REACT SETTINGS* ⚡\n` +
                        `╚════════════════════════════╝\n\n` +
                        `• *Master Status:* ${config.autoReact ? '🟢 Active' : '🔴 Disabled'}\n` +
                        `• *Private Chats:* ${config.reactInPrivate ? '🟢 Active' : '🔴 Disabled'}\n` +
                        `• *Group Chats:* ${config.reactInGroups ? '🟢 Active' : '🔴 Disabled'}\n` +
                        `• *React to Own Messages:* ${config.reactToOwnMessages ? '🟢 Active' : '🔴 Disabled'}\n\n` +
                        `👉 *Commands:*\n` +
                        `• \`${config.prefix}react on\` ➔ Turn ON everywhere\n` +
                        `• \`${config.prefix}react off\` ➔ Turn OFF\n` +
                        `• \`${config.prefix}react own on/off\` ➔ React to own messages\n` +
                        `• \`${config.prefix}react group on/off\` ➔ Groups toggle\n` +
                        `• \`${config.prefix}react private on/off\` ➔ Private chats toggle`
                },
                isFromMe ? undefined : { quoted: msg }
              ).catch(() => {});
              continue;
            }
          }

          // .owner on / off or .private on / off (Strict Owner Security Toggle)
          if (command === 'owner' || command === 'private' || command === 'ownersonly') {
            if (param === 'on' || param === '1') {
              config.ownerOnlyCommands = true;
              savePersistentSettings();
              await sock.sendMessage(remoteJid, { text: '🔒 *Strict Owner-Only Mode is now ON!*\n\nTamam bot commands sirf Bot Owner (Kaleem Khan) use kar sakta hai. 👑' }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
              continue;
            } else if (param === 'off' || param === '0') {
              config.ownerOnlyCommands = false;
              savePersistentSettings();
              await sock.sendMessage(remoteJid, { text: '🔓 *Owner-Only Mode is now OFF!*\n\nAb sab users commands use kar sakte hain.' }, isFromMe ? undefined : { quoted: msg }).catch(() => {});
              continue;
            }
          }

          // .unwarn / .clearwarnings (Owner tool to reset user warnings)
          if (command === 'unwarn' || command === 'clearwarnings' || command === 'resetwarnings') {
            const targetNum = query.replace(/\D/g, '');
            if (targetNum) {
              userWarningCounts.delete(targetNum);
              saveUserWarnings();
              await sock.sendMessage(remoteJid, { text: `✅ User *${targetNum}* ki warnings reset kar di gayi hain.` }, isFromMe ? undefined : { quoted: msg });
            } else {
              userWarningCounts.clear();
              saveUserWarnings();
              await sock.sendMessage(remoteJid, { text: `✅ Tamam users ki warnings reset kar di gayi hain.` }, isFromMe ? undefined : { quoted: msg });
            }
            continue;
          }

          // .unblock (Owner tool to unblock a user)
          if (command === 'unblock') {
            const targetNum = query.replace(/\D/g, '');
            if (targetNum) {
              const targetJid = targetNum + '@s.whatsapp.net';
              try {
                await sock.updateBlockStatus(targetJid, 'unblock');
                userWarningCounts.delete(targetNum);
                saveUserWarnings();
                await sock.sendMessage(remoteJid, { text: `✅ User *${targetNum}* ko unblock kar diya gaya hai.` }, isFromMe ? undefined : { quoted: msg });
              } catch (e) {
                await sock.sendMessage(remoteJid, { text: `❌ Unblock karne mein error: ${e.message}` }, isFromMe ? undefined : { quoted: msg });
              }
            } else {
              await sock.sendMessage(remoteJid, { text: `👉 Format: \`${config.prefix}unblock 923xxxxxxxxx\`` }, isFromMe ? undefined : { quoted: msg });
            }
            continue;
          }

          // .ping (Speed & Stats)
          if (command === 'ping' || command === 'speed' || command === 'stats') {
            const uptime = Math.floor((Date.now() - botStartTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

            const pingText = `🏓 *PONG! WhatsApp Super Bot Pro*\n\n` +
              `⚡ *Speed:* Super Fast 0ms Latency\n` +
              `⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n` +
              `💾 *RAM Usage:* ${memory} MB\n` +
              `🤖 *AI Auto-Reply:* ${config.aiAutoReply ? '🟢 Active (ChatGPT/Llama 3.3)' : '🔴 Disabled'}\n` +
              `📱 *Owner:* 923267004137\n` +
              `🌐 *Server:* Active & Running 24/7`;
            try {
              await sock.sendMessage(remoteJid, { text: pingText }, isFromMe ? undefined : { quoted: msg });
            } catch (pErr) {
              await sock.sendMessage(remoteJid, { text: pingText }).catch(() => {});
            }
            continue;
          }

          // 📜 .menu / .help / .dashboard (Ultra Stylish Master Menu & Dashboard)
          if (command === 'help' || command === 'menu' || command === 'commands' || command === 'dashboard') {
            const menuText = `╔════════════════════════════╗
  👑 *WHATSAPP SUPER BOT PRO* 👑
╚════════════════════════════╝

👋 *Assalam o Alaikum, ${msg.pushName || 'Friend'}!*
⚡ *Speed:* 0ms Ultra-Fast Latency
📱 *Owner:* Kaleem Khan (923267004137)
🔑 *Prefix:* [ \`${config.prefix}\` ]

┌── 🧠 *CHATGPT / AI ASSISTANT* ───
│ 🔹 \`${config.prefix}ai <sawal>\` ➔ Ask ChatGPT Anything
│ 🔹 \`${config.prefix}ai @user\` ➔ Turn AI ON for specific user/chat 🎯
│ 🔹 \`${config.prefix}ai remove @user\` ➔ Remove user from AI list
│ 🔹 \`${config.prefix}ai list\` ➔ View active AI whitelist
│ 🔹 \`${config.prefix}ai all on\` ➔ Turn ON for everyone (Global)
│ 🔹 \`${config.prefix}ai off\` ➔ Turn OFF AI Auto-Reply
└──────────────────────────

┌── 🗑️ *MEDIA & RECOVERY TOOLS* ───
│ 🔹 \`${config.prefix}view\` ya \`${config.prefix}vo\` ➔ Unlock View-Once Media 🔓
│ 🔹 \`${config.prefix}viewonce auto on/off\` ➔ Auto-Send View-Once to Owner DM
│ 🔹 \`${config.prefix}deleterecovery\` ➔ Recover Deleted Msg & Media 🗑️
│ 🔹 \`${config.prefix}antidelete on/off\` ➔ Realtime Auto-Recover in Chat
└──────────────────────────

┌── 🕌 *ISLAMIC SUITE* ─────────
│ 🔹 \`${config.prefix}islamicdate\` ➔ Live Hijri / Islamic Date
│ 🔹 \`${config.prefix}naat <name>\` ➔ Popular Urdu Naats (~1 Min)
│ 🔹 \`${config.prefix}namaz <city>\` ➔ Daily Prayer Timings
│ 🔹 \`${config.prefix}ayat\` ➔ Daily Quranic Verse
│ 🔹 \`${config.prefix}hadith\` ➔ Sahih Hadith Shareef
└──────────────────────────

┌── 🎵 *ENTERTAINMENT & UTILITY* ──
│ 🔹 \`${config.prefix}fun\` ➔ 13 Viral Meme Sounds (Aayein, Faaah, etc.)
│ 🔹 \`${config.prefix}aujla <song>\` ➔ Karan Aujla Hit Songs
│ 🔹 \`${config.prefix}weather <city>\` ➔ Live Weather Report
│ 🔹 \`${config.prefix}crypto\` ➔ Live Crypto Rates (BTC/ETH)
└──────────────────────────

┌── ⚙️ *SYSTEM & SETTINGS* ────────
│ 🔹 \`${config.prefix}react on / off\` ➔ Master Auto-React Toggle
│ 🔹 \`${config.prefix}react own on/off\` ➔ React to Own Messages
│ 🔹 \`${config.prefix}react group on/off\` ➔ React in Groups Toggle
│ 🔹 \`${config.prefix}react private on/off\` ➔ React in Private DM Toggle
│ 🔹 \`${config.prefix}owner on/off\` ➔ Strict Owner Security Mode
│ 🔹 \`${config.prefix}ping\` ➔ Speed & RAM Stats
└──────────────────────────

🤖 *AI Auto-Reply:* ${config.aiAutoReply ? (config.aiMode === 'all' ? '🟢 Global (All Users)' : `🎯 Specific (${config.aiAllowedUsers?.length || 0} users)`) : '🔴 Disabled'}
⚡ *Auto-React:* ${config.autoReact ? '🟢 Active' : '🔴 Disabled'}
🗑️ *Auto Anti-Delete:* ${config.antiDeleteAuto ? '🟢 Active' : '🔴 Disabled'}
🔓 *Auto View-Once:* ${config.viewOnceAuto ? '🟢 Active' : '🔴 Disabled'}`;

            try {
              await sock.sendMessage(remoteJid, { text: menuText }, isFromMe ? undefined : { quoted: msg });
            } catch (mErr) {
              await sock.sendMessage(remoteJid, { text: menuText }).catch(() => {});
            }
            continue;
          }

        }

        // ---------------- ⚡ SUPER FAST AUTO REACT LOGIC ----------------
        if (config.autoReact && !reactedMessageIds.has(msg.key.id)) {
          const shouldReactSender = !isFromMe || (config.reactToOwnMessages && !usedPrefix);
          const shouldReactChat = (isGroup && config.reactInGroups !== false) || (!isGroup && config.reactInPrivate !== false);

          if (shouldReactSender && shouldReactChat) {
            reactedMessageIds.add(msg.key.id);
            if (reactedMessageIds.size > 2000) {
              const firstKey = reactedMessageIds.values().next().value;
              reactedMessageIds.delete(firstKey);
            }
            const emoji = getRandomEmoji();
            sock.sendMessage(remoteJid, {
              react: {
                text: emoji,
                key: msg.key
              }
            }).then(() => {
              console.log(`⚡ [REACT] [${emoji}] in ${isGroup ? 'Group' : 'Private'} (${remoteJid})`);
            }).catch((e) => {
              console.error('Reaction error:', e?.message || e);
            });
          }
        }

        // ---------------- 🤖 4. HUMAN-LIKE AI AUTO-REPLY LOGIC (CHATGPT FEEL) ----------------
        if (!usedPrefix && trimmedText && config.aiAutoReply) {
          const shouldAiReplySender = !isFromMe;
          const shouldAiReplyChat = (!isGroup && config.aiReplyInPrivate) || (isGroup && config.aiReplyInGroups);

          if (shouldAiReplySender && shouldAiReplyChat) {
            const senderClean = extractCleanNumber(senderJid);
            const chatClean = extractCleanNumber(remoteJid);

            let isAllowed = false;
            if (config.aiMode === 'all') {
              isAllowed = true;
            } else {
              const allowedList = Array.isArray(config.aiAllowedUsers) ? config.aiAllowedUsers : [];
              isAllowed = allowedList.some(u => {
                const uClean = extractCleanNumber(u);
                return (uClean && (uClean === senderClean || uClean === chatClean)) ||
                       u === senderJid || u === remoteJid;
              });
            }

            if (isAllowed) {
              try {
                console.log(`🧠 [AI AUTO-REPLY] Answering query for ${senderClean || remoteJid}: "${trimmedText.slice(0, 50)}"`);
                try { await sock.sendPresenceUpdate('composing', remoteJid); } catch (e) {}

                const aiAnswer = await askOpenRouterAI(trimmedText, remoteJid, msg.pushName || 'Friend');
                try { await sock.sendPresenceUpdate('paused', remoteJid); } catch (e) {}

                if (aiAnswer) {
                  await sock.sendMessage(
                    remoteJid,
                    { text: aiAnswer },
                    { quoted: msg }
                  );
                  console.log(`🤖 [AI AUTO-REPLY SENT] to ${remoteJid}`);
                }
              } catch (aiErr) {
                console.error('AI Auto-reply error:', aiErr?.message || aiErr);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Message upsert error:', err?.message || err);
    }
  });
  } catch (err) {
    isStartingBot = false;
    console.error('Error in startBot:', err);
  }
}

startBot().catch((err) => {
  console.error('Failed to start WhatsApp bot:', err);
});