import type { Request, Response, NextFunction } from "express";
import { refreshAccessToken, RefreshTokenExpiredError } from "../auth/spotify-auth.js";
import { updateUserRefreshToken, clearUserRefreshToken } from "../db.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tokens = req.session.tokens;

  if (!tokens || !req.session.userId || !req.session.siteAuthorized) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (Date.now() >= tokens.expiresAt) {
    try {
      const newTokens = await refreshAccessToken(tokens.refreshToken);
      req.session.tokens = newTokens;
      updateUserRefreshToken(req.session.userId, newTokens.refreshToken);
    } catch (err) {
      if (err instanceof RefreshTokenExpiredError) {
        // Token is permanently dead — discard it and end the session so the
        // client's 401 redirect lands on a clean sign-in (not a redirect loop,
        // since /auth/me reads the now-destroyed session). Do not retry.
        clearUserRefreshToken(req.session.userId);
        return req.session.destroy(() =>
          res.status(401).json({ error: "Reauthorization required" })
        );
      }
      // Transient failure (network, 5xx) — keep the token and let the client retry.
      return res.status(401).json({ error: "Token refresh failed" });
    }
  }

  next();
}
