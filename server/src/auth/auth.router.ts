import { Router } from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { getAuthorizeUrl, exchangeCodeForTokens } from "./spotify-auth.js";

export const authRouter = Router();

authRouter.get("/login", (req, res) => {
  const state = crypto.randomUUID();
  req.session.oauthState = state;
  res.redirect(getAuthorizeUrl(state));
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
    req.session.tokens = tokens;
    delete req.session.oauthState;
    res.redirect(`${config.clientOrigin}/artists`);
  } catch (err) {
    console.error("Token exchange error:", err);
    res.status(500).send("Authentication failed");
  }
});

authRouter.get("/me", (req, res) => {
  const authenticated = !!req.session.tokens;
  res.json({ authenticated });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});
