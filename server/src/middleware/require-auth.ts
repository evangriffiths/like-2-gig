import type { Request, Response, NextFunction } from "express";
import { refreshAccessToken } from "../auth/spotify-auth.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tokens = req.session.tokens;

  if (!tokens) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (Date.now() >= tokens.expiresAt) {
    try {
      req.session.tokens = await refreshAccessToken(tokens.refreshToken);
    } catch {
      return res.status(401).json({ error: "Token refresh failed" });
    }
  }

  next();
}
