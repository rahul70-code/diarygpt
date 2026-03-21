import { getOne, upsert } from "../helpers.js";

const TABLE = "app_config";
const SINGLETON_KEY = "default";

export const Config = {
  /** Return the active provider config (single-row table). */
  get() {
    return getOne(TABLE, { key: SINGLETON_KEY });
  },

  /**
   * Persist the active provider config (creates or replaces the singleton row).
   * @param {{ provider: string, model: string, api_key?: string }} data
   */
  set(data) {
    return upsert(
      TABLE,
      {
        key: SINGLETON_KEY,
        provider: data.provider,
        model: data.model,
        api_key: data.api_key ?? null,
        updated_at: new Date().toISOString(),
      },
      ["key"]
    );
  },
};
