import "dotenv/config";
import express from "express";
import path from "path";
import authRoutes from "./routes/auth.js";
import diaryRoutes from "./routes/diary.js";
import chatRoutes from "./routes/chat.js";
import configRoutes from "./routes/config.js";
import searchRoutes from "./routes/search.js";
import insightsRoutes from "./routes/insights.js";
import voiceRoutes from "./routes/voice.js";
import therapyRoutes from "./routes/therapy.js";
import { authMiddleware } from "./middleware/auth.js";
import { userConfigMiddleware } from "./storage/configStore.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("frontend/out"));
app.use(express.static("public"));

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes — require valid JWT + per-user config context
app.use("/api/diary",    authMiddleware, userConfigMiddleware, diaryRoutes);
app.use("/api/chat",     authMiddleware, userConfigMiddleware, chatRoutes);
app.use("/api/search",   authMiddleware, userConfigMiddleware, searchRoutes);
app.use("/api/config",   authMiddleware, userConfigMiddleware, configRoutes);
app.use("/api/insights", authMiddleware, userConfigMiddleware, insightsRoutes);
app.use("/api/voice",    authMiddleware, userConfigMiddleware, voiceRoutes);
app.use("/api/therapy",  authMiddleware, userConfigMiddleware, therapyRoutes);

// Serve index.html for any other client route to support SPA page refreshes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  // Route dynamic diary paths to the correct static export templates
  const diaryMatch = req.path.match(/^\/diary\/([^/]+)\/?$/);
  if (diaryMatch) {
    const id = diaryMatch[1];
    if (id === "new") {
      return res.sendFile(path.resolve("frontend/out/diary/new/index.html"));
    } else {
      return res.sendFile(path.resolve("frontend/out/diary/placeholder/index.html"));
    }
  }

  res.sendFile(path.resolve("frontend/out/index.html"), (err) => {
    if (err) {
      // If the frontend build is not generated yet, return API running message
      res.json({ message: "DairyGPT API is running. Build the frontend to see the UI." });
    }
  });
});

if (!process.env.JWT_SECRET) {
  console.warn("[warn] JWT_SECRET is not set — auth will fail on all protected routes");
}

app.listen(PORT, () => {
  console.log(`DairyGPT running at http://localhost:${PORT}`);
});
