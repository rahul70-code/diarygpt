import { Router } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { Users } from "../db/models/users.js";

const router = Router();

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, getSecret(), { expiresIn: "30d" });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });
    if (password.length < 8)
      return res.status(400).json({ error: "password must be at least 8 characters" });

    const existing = await Users.getByEmail(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hash = await argon2.hash(password);
    const user = await Users.create({
      id: uuidv4(),
      email,
      encryption_key_hash: hash,
      storage_mode: process.env.STORAGE_MODE || "local",
      embedding_provider: process.env.EMBEDDING_PROVIDER || "ollama",
    });

    res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });

    const user = await Users.getByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Reject the legacy seed user from logging in via password flow
    if (user.encryption_key_hash === "no-encryption")
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await argon2.verify(user.encryption_key_hash, password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ token: signToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
