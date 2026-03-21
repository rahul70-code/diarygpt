import { Router } from "express";
import { getConfig, setConfig, PROVIDER_MODELS } from "../storage/configStore.js";

const router = Router();

// GET /api/config — current provider config + available options
router.get("/", (_req, res) => {
  const config = getConfig();
  res.json({
    active: {
      provider: config.provider,
      model: config.model,
      hasCustomKey: !!config.apiKey,
    },
    available: PROVIDER_MODELS,
  });
});

// POST /api/config — switch provider/model or set a custom API key
// Body: { provider?, model?, apiKey? }
router.post("/", (req, res) => {
  const { provider, model, apiKey } = req.body;
  if (!provider && !model && !apiKey) {
    return res.status(400).json({ error: "Provide at least one of: provider, model, apiKey" });
  }

  const updates = {};
  if (provider) updates.provider = provider;
  if (model) updates.model = model;
  if (apiKey !== undefined) updates.apiKey = apiKey || null; // "" clears the key

  const next = setConfig(updates);
  res.json({
    provider: next.provider,
    model: next.model,
    hasCustomKey: !!next.apiKey,
  });
});

export default router;
