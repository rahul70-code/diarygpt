import { getMany, remove, insertEmbedding, vectorSearch } from '../adapter.js';

const TABLE = 'embeddings';

export const Embeddings = {
  /** Return all embedding chunks for an entry, ordered by position. */
  getByEntry(entry_id) {
    return getMany(TABLE, { entry_id }, { orderBy: 'chunk_index ASC' });
  },

  /**
   * Insert one embedding chunk.
   * Delegates to the active adapter so the vector is stored correctly
   * for each backend (BLOB for SQLite, VECTOR column for PostgreSQL).
   *
   * @param {{ id?: string, entry_id: string, embedding: number[], model_used: string, chunk_text_encrypted: string, chunk_index: number }} data
   */
  create(data) {
    return insertEmbedding(data);
  },

  /**
   * Cosine similarity search — returns top K chunks scoped to a user.
   * Delegated to the active adapter (pgvector <=> or sqlite-vec vec_distance_cosine).
   *
   * @param {string} user_id
   * @param {number[]} queryVector
   * @param {{ k?: number, threshold?: number }} options
   * @returns {{ id, entry_id, chunk_index, chunk_text_encrypted, model_used, score }[]}
   */
  similaritySearch(user_id, queryVector, options = {}) {
    return vectorSearch(user_id, queryVector, options);
  },

  /** Delete all embedding chunks for an entry. */
  deleteByEntry(entry_id) {
    return remove(TABLE, { entry_id });
  },
};
