import { getOne, getMany, insert, remove } from "../helpers.js";

const TABLE = "chat_sessions";

export const ChatSessions = {
  /** Return all sessions for a user, newest first. */
  getAllByUser(user_id) {
    return getMany(TABLE, { user_id }, { orderBy: "created_at DESC" });
  },

  /** Get a single session by id. */
  getById(id) {
    return getOne(TABLE, { id });
  },

  /**
   * Create a new chat session.
   * @param {{ user_id: string, title?: string }} data
   */
  create(data) {
    return insert(TABLE, data);
  },

  /** Delete a session and all its messages (cascade). */
  deleteById(id) {
    return remove(TABLE, { id });
  },
};
