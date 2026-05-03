import jwt from "jsonwebtoken";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, getSecret());
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
