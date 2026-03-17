import { Router } from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { getAuthorizeUrl, exchangeCodeForTokens } from "./spotify-auth.js";
import { upsertUser } from "../db.js";

export const authRouter = Router();

authRouter.get("/login", (req, res) => {
  const state = crypto.randomUUID();
  req.session.oauthState = state;
  req.session.save(() => {
    res.redirect(getAuthorizeUrl(state));
  });
});

authRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error("Spotify auth error:", error);
    return res.redirect(config.clientOrigin);
  }

  if (!code || !state || state !== req.session.oauthState) {
    return res.status(403).send("Invalid state parameter");
  }

  try {
    const tokens = await exchangeCodeForTokens(code as string);

    // Fetch Spotify user profile
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!profileRes.ok) throw new Error("Failed to fetch Spotify profile");
    const profile = await profileRes.json();

    req.session.tokens = tokens;
    req.session.userId = profile.id;
    req.session.displayName = profile.display_name || profile.id;
    delete req.session.oauthState;

    upsertUser(profile.id, profile.display_name || profile.id, tokens.refreshToken, profile.email);

    res.redirect(`${config.clientOrigin}/artists`);
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).send("Authentication failed");
  }
});

authRouter.get("/me", (req, res) => {
  const authenticated = !!(req.session.tokens && req.session.userId);
  res.json({
    authenticated,
    userId: req.session.userId || null,
    displayName: req.session.displayName || null,
  });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
