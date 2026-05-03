import { getOne, getMany, insert, update, remove } from "../helpers.js";

const TABLE = "therapy_sessions";

export const TherapySessions = {
  getAllByUser(user_id) {
    return getMany(TABLE, { user_id }, { orderBy: "created_at DESC" });
  },

  getById(id) {
    return getOne(TABLE, { id });
  },

  create(data) {
    return insert(TABLE, data);
  },

  flag(id) {
    return update(TABLE, { flagged: 1 }, { id });
  },

  deleteById(id) {
    return remove(TABLE, { id });
  },
};
