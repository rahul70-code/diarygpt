import { getOne, insert, update } from "../helpers.js";

const TABLE = "users";

export const Users = {
  /** Find a user by id. */
  getById(id) {
    return getOne(TABLE, { id });
  },

  /** Find a user by email. */
  getByEmail(email) {
    return getOne(TABLE, { email });
  },

  /**
   * Create a new user.
   * @param {{ id?: string, email: string, encryption_key_hash: string, storage_mode?: string, embedding_provider?: string }} data
   */
  create(data) {
    return insert(TABLE, data);
  },

  /**
   * Update user settings.
   * @param {string} id
   * @param {Partial<{ storage_mode: string, embedding_provider: string, encryption_key_hash: string }>} data
   */
  updateById(id, data) {
    return update(TABLE, data, { id });
  },
};
