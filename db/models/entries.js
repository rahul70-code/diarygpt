import { getOne, getMany, insert, update, remove, upsert } from "../helpers.js";

const TABLE = "entries";

export const Entries = {
  /** Return all entries ordered by newest first. */
  getAll() {
    return getMany(TABLE, {}, { orderBy: "created_at DESC" });
  },

  /** Return a single entry by id. */
  getById(id) {
    return getOne(TABLE, { id });
  },

  /**
   * Create a new entry.
   * @param {{ id: string, title: string, body: string, analysis: object, created_at: string }} data
   */
  create(data) {
    return insert(TABLE, {
      ...data,
      analysis: JSON.stringify(data.analysis ?? null),
    });
  },

  /**
   * Update an entry by id.
   * @param {string} id
   * @param {Partial<{ title: string, body: string, analysis: object, updated_at: string }>} data
   */
  updateById(id, data) {
    const payload = { ...data, updated_at: new Date().toISOString() };
    if (payload.analysis !== undefined) {
      payload.analysis = JSON.stringify(payload.analysis);
    }
    return update(TABLE, payload, { id });
  },

  /** Delete an entry by id and return it. */
  deleteById(id) {
    return remove(TABLE, { id });
  },

  /** Upsert by id (insert or update). */
  upsertById(data) {
    return upsert(
      TABLE,
      {
        ...data,
        analysis: JSON.stringify(data.analysis ?? null),
      },
      ["id"]
    );
  },
};
