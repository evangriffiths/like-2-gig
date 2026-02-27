import express from "express";
import cors from "cors";
import session from "express-session";
import { config } from "./config.js";
import { authRouter } from "./auth/auth.router.js";
import { artistsRouter } from "./api/artists.router.js";
import { requireAuth } from "./middleware/require-auth.js";

const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, sameSite: "lax" },
  })
);

app.use("/auth", authRouter);
app.use("/api", requireAuth, artistsRouter);

app.listen(config.port, () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
});
