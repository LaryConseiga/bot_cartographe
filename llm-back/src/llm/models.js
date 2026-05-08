/**
 * Module for HuggingFace model clients.
 * Uses @huggingface/inference for all LLM and embedding calls.
 */

const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);

const CHAT_MODEL = "mistralai/Mistral-Small-3.1-24B-Instruct-2503";
const EXTRACT_MODEL = "deepseek-ai/DeepSeek-R1-Distill-Llama-8B";
const EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2";

async function streamChat(messages, onToken) {
  let full = "";
  try {
    const stream = await hf.chatCompletionStream({
      model: CHAT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024
    });

    for await (const chunk of stream) {
      const token = chunk?.choices?.[0]?.delta?.content;
      if (typeof token === "string" && token.length) {
        full += token;
        if (typeof onToken === "function") onToken(token);
      }
    }
    return full;
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("503") || msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("overloaded")) {
      const apology = "Désolé, le service est temporairement surchargé. Réessaie dans quelques secondes.";
      if (typeof onToken === "function") onToken(apology);
      return apology;
    }
    throw err;
  }
}

async function extractStructured(prompt) {
  try {
    const out = await hf.chatCompletion({
      model: EXTRACT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 512
    });
    return out?.choices?.[0]?.message?.content || "";
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("503") || msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("overloaded")) {
      return "Désolé, le service est temporairement surchargé. Réessaie dans quelques secondes.";
    }
    throw err;
  }
}

async function embedText(text) {
  try {
    const res = await hf.featureExtraction({
      model: EMBED_MODEL,
      inputs: text
    });

    // HF may return:
    // - number[] (vector)
    // - number[][] (batch)
    // - nested arrays depending on pipeline
    const v = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
    if (!Array.isArray(v)) return [];
    return v;
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("503") || msg.toLowerCase().includes("rate") || msg.toLowerCase().includes("overloaded")) {
      return [];
    }
    throw err;
  }
}

module.exports = {
  hf,
  CHAT_MODEL,
  EXTRACT_MODEL,
  EMBED_MODEL,
  streamChat,
  extractStructured,
  embedText
};

