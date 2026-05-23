import { Router } from "express";
import { getConfig, setConfig, PROVIDER_MODELS, PROVIDER_PRIVACY } from "../storage/configStore.js";

const router = Router();

// GET /api/config — current provider config + available options with privacy tiers
router.get("/", (_req, res) => {
  const config = getConfig();
  res.json({
    active: {
      provider:     config.provider,
      model:        config.model,
      hasCustomKey: !!config.apiKey,
      privacy:      PROVIDER_PRIVACY[config.provider] ?? "cloud",
    },
    available:    PROVIDER_MODELS,
    privacyTiers: PROVIDER_PRIVACY,
  });
});

// POST /api/config — switch provider/model or set a custom API key
// Body: { provider?, model?, apiKey? }
router.post("/", (req, res) => {
  const { provider, model, apiKey } = req.body;
  if (!provider && !model && apiKey === undefined) {
    return res.status(400).json({ error: "Provide at least one of: provider, model, apiKey" });
  }

  const updates = {};
  if (provider) updates.provider = provider;
  if (model)    updates.model    = model;
  if (apiKey !== undefined) updates.apiKey = apiKey || null; // "" clears the key

  try {
    const next = setConfig(updates);
    res.json({
      provider:     next.provider,
      model:        next.model,
      hasCustomKey: !!next.apiKey,
      privacy:      PROVIDER_PRIVACY[next.provider] ?? "cloud",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
