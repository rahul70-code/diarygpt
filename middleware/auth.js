import jwt from "jsonwebtoken";
import { Users } from "../db/models/users.js";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, getSecret());
    const user = await Users.getById(payload.id);
    if (!user) return res.status(401).json({ error: "Invalid or expired token" });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
