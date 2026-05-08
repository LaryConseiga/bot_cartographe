/**
 * Simple chain exports for orchestration.
 * Keeps orchestrator helpers tidy for MVP.
 */

const { buildChatSystemPrompt, buildExtractionPrompt, buildSynthesisPrompt } = require("./prompts");
const { TaskType, detectTaskType, computeProfileCompleteness } = require("./router");
const { getLastN, appendMessage, clearSession, getHistory } = require("./memory");
const { buildStudentContext, supabase } = require("./context");
const { similaritySearch, embedAndStoreCV } = require("./rag");
const { streamChat, extractStructured } = require("./models");

module.exports = {
  buildChatSystemPrompt,
  buildExtractionPrompt,
  buildSynthesisPrompt,
  TaskType,
  detectTaskType,
  computeProfileCompleteness,
  getLastN,
  getHistory,
  appendMessage,
  clearSession,
  buildStudentContext,
  supabase,
  similaritySearch,
  embedAndStoreCV,
  streamChat,
  extractStructured
};

