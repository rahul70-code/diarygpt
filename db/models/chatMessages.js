import { getMany, insert } from "../helpers.js";

const TABLE = "chat_messages";

export const ChatMessages = {
  /**
   * Return all messages in a session, oldest first (chronological for LLM context).
   * Optionally limit to the last N messages.
   * @param {string} session_id
   * @param {{ limit?: number }} options
   */
  getBySession(session_id, { limit } = {}) {
    return getMany(TABLE, { session_id }, { orderBy: "created_at ASC", limit });
  },

  /**
   * Insert a new message.
   * @param {{ session_id: string, role: 'user'|'assistant', content_encrypted: string, context_entry_ids?: string[] }} data
   */
  create(data) {
    return insert(TABLE, {
      ...data,
      context_entry_ids: data.context_entry_ids
        ? JSON.stringify(data.context_entry_ids)
        : null,
    });
  },
};
