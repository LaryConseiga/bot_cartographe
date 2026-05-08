/**
 * RAG pipeline using pgvector in Supabase.
 * Embeds text chunks and retrieves relevant context for LLM prompts.
 */

const { embedText } = require("./models");
const { supabase } = require("./context");

const CHUNK_SIZE = 300;
const CHUNK_OVERLAP = 50;

function splitIntoChunks(text) {
  const t = String(text || "").trim();
  if (!t) return [];

  const words = t.split(/\s+/);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + CHUNK_SIZE);
    chunks.push(slice.join(" "));
    if (i + CHUNK_SIZE >= words.length) break;
    i += Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);
  }
  return chunks;
}

function normalizeVector(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  });
}

async function embedAndStoreCV(studentId, cvText) {
  const chunks = splitIntoChunks(cvText);
  let stored = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    try {
      const embedding = normalizeVector(await embedText(chunk));
      if (!embedding.length) continue;

      const row = {
        source_type: "cv",
        source_id: studentId,
        content: chunk,
        embedding,
        metadata: { student_id: studentId, chunk_index: idx }
      };

      const { error } = await supabase.from("knowledge_chunks").upsert(row, {
        onConflict: "source_type,source_id,content"
      });
      if (!error) stored += 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("[rag] embedAndStoreCV chunk error:", e?.message || e);
    }
  }

  return stored;
}

async function embedAndStoreJob(jobId, description) {
  const chunks = splitIntoChunks(description);
  let stored = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    try {
      const embedding = normalizeVector(await embedText(chunk));
      if (!embedding.length) continue;

      const row = {
        source_type: "job",
        source_id: jobId,
        content: chunk,
        embedding,
        metadata: { job_id: jobId, chunk_index: idx }
      };

      const { error } = await supabase.from("knowledge_chunks").upsert(row, {
        onConflict: "source_type,source_id,content"
      });
      if (!error) stored += 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("[rag] embedAndStoreJob chunk error:", e?.message || e);
    }
  }

  return stored;
}

async function similaritySearch(query, options = {}) {
  const { filterSource = null, k = 5 } = options || {};
  try {
    const embedding = normalizeVector(await embedText(query));
    if (!embedding.length) return [];

    const filter = filterSource ? { source_type: filterSource } : {};
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: embedding,
      match_count: k,
      filter
    });

    if (error) {
      // eslint-disable-next-line no-console
      console.log("[rag] similaritySearch rpc error:", error.message);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];
    return rows.map((r) => r?.content).filter(Boolean);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("[rag] similaritySearch error:", e?.message || e);
    return [];
  }
}

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  splitIntoChunks,
  embedAndStoreCV,
  embedAndStoreJob,
  similaritySearch
};

