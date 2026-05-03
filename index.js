import "dotenv/config";
import express from "express";
import authRoutes from "./routes/auth.js";
import diaryRoutes from "./routes/diary.js";
import chatRoutes from "./routes/chat.js";
import configRoutes from "./routes/config.js";
import searchRoutes from "./routes/search.js";
import insightsRoutes from "./routes/insights.js";
import { authMiddleware } from "./middleware/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes — require valid JWT
app.use("/api/diary", authMiddleware, diaryRoutes);
app.use("/api/chat", authMiddleware, chatRoutes);
app.use("/api/search", authMiddleware, searchRoutes);
app.use("/api/config", authMiddleware, configRoutes);
app.use("/api/insights", authMiddleware, insightsRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "DairyGPT API is running" });
});

if (!process.env.JWT_SECRET) {
  console.warn("[warn] JWT_SECRET is not set — auth will fail on all protected routes");
}

app.listen(PORT, () => {
  console.log(`DairyGPT running at http://localhost:${PORT}`);
});
