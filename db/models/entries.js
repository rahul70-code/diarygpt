import { getOne, getMany, insert, update, remove } from "../helpers.js";

const TABLE = "entries";

export const Entries = {
  /** Return all entries for a user, newest first. */
  getAllByUser(user_id) {
    return getMany(TABLE, { user_id }, { orderBy: "written_at DESC" });
  },

  /** Return a single entry by id. */
  getById(id) {
    return getOne(TABLE, { id });
  },

  /**
   * Create a new entry.
   * @param {{ id?: string, user_id: string, title_encrypted: string, body_encrypted: string, content_hash: string, written_at: string }} data
   */
  create(data) {
    return insert(TABLE, data);
  },

  /**
   * Update an entry by id.
   * @param {string} id
   * @param {Partial<{ title_encrypted: string, body_encrypted: string, content_hash: string, written_at: string }>} data
   */
  updateById(id, data) {
    return update(TABLE, { ...data, updated_at: new Date().toISOString() }, { id });
  },

  /** Delete an entry by id and return deleted rows. */
  deleteById(id) {
    return remove(TABLE, { id });
  },
};
