import "dotenv/config";
import express from "express";
import diaryRoutes from "./routes/diary.js";
import chatRoutes from "./routes/chat.js";
import configRoutes from "./routes/config.js";
import searchRoutes from "./routes/search.js";
import { ensureDefaultUser } from "./db/seed.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use("/api/diary", diaryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/config", configRoutes);
app.use("/api/search", searchRoutes);

app.get("/", (_req, res) => {
  res.json({ message: "DairyGPT API is running" });
});

await ensureDefaultUser();
app.listen(PORT, () => {
  console.log(`DairyGPT running at http://localhost:${PORT}`);
});
