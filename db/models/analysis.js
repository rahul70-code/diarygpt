import { getOne, insert, update } from "../helpers.js";

const TABLE = "analysis";

export const Analysis = {
  /** Get analysis for an entry. */
  getByEntry(entry_id) {
    return getOne(TABLE, { entry_id });
  },

  /**
   * Insert analysis for an entry.
   * @param {{ entry_id: string, mood?: string, themes?: string[], reflection_encrypted?: string, follow_up_question?: string }} data
   */
  create(data) {
    return insert(TABLE, {
      ...data,
      themes: data.themes ? JSON.stringify(data.themes) : null,
    });
  },

  /**
   * Update analysis for an entry.
   * @param {string} entry_id
   * @param {Partial<{ mood: string, themes: string[], reflection_encrypted: string, follow_up_question: string }>} data
   */
  updateByEntry(entry_id, data) {
    const payload = { ...data };
    if (payload.themes !== undefined) {
      payload.themes = JSON.stringify(payload.themes);
    }
    return update(TABLE, payload, { entry_id });
  },
};
