import { getMany, insert } from "../helpers.js";

const TABLE = "mood_logs";

export const MoodLogs = {
  getByUser(user_id, { limit } = {}) {
    return getMany(TABLE, { user_id }, { orderBy: "logged_at ASC", limit });
  },

  create(data) {
    return insert(TABLE, data);
  },
};
