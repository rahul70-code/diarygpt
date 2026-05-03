import { getMany, insert } from "../helpers.js";

const TABLE = "therapy_messages";

export const TherapyMessages = {
  getBySession(session_id, { limit } = {}) {
    return getMany(TABLE, { session_id }, { orderBy: "created_at ASC", limit });
  },

  create(data) {
    return insert(TABLE, data);
  },
};
