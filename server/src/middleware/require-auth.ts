import type { Request, Response, NextFunction } from "express";
import { refreshAccessToken } from "../auth/spotify-auth.js";
import { updateUserRefreshToken } from "../db.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tokens = req.session.tokens;

  if (!tokens || !req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (Date.now() >= tokens.expiresAt) {
    try {
      const newTokens = await refreshAccessToken(tokens.refreshToken);
      req.session.tokens = newTokens;
      updateUserRefreshToken(req.session.userId, newTokens.refreshToken);
    } catch {
      return res.status(401).json({ error: "Token refresh failed" });
    }
  }

  next();
}
