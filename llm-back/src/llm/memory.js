/**
 * Redis-based conversation history management.
 * Stores messages as JSON arrays per session.
 */

const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);
const SESSION_TTL = 86400; // 24 hours

function key(sessionId) {
  return `session:${sessionId}`;
}

async function getHistory(sessionId) {
  try {
    const raw = await redis.get(key(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendMessage(sessionId, role, content) {
  try {
    const hist = await getHistory(sessionId);
    hist.push({ role, content, timestamp: Date.now() });
    await redis.set(key(sessionId), JSON.stringify(hist), "EX", SESSION_TTL);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[redis] appendMessage error:", e?.message || e);
  }
}

async function clearSession(sessionId) {
  try {
    await redis.del(key(sessionId));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[redis] clearSession error:", e?.message || e);
  }
}

async function getLastN(sessionId, n = 10) {
  const hist = await getHistory(sessionId);
  return hist.slice(Math.max(0, hist.length - n));
}

module.exports = {
  redis,
  SESSION_TTL,
  getHistory,
  appendMessage,
  clearSession,
  getLastN
};

