import express from "express";
import cors from "cors";
import session from "express-session";
// @ts-expect-error no type declarations
import BetterSqlite3SessionStore from "better-sqlite3-session-store";
import BetterSqlite3 from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { authRouter } from "./auth/auth.router.js";
import { artistsRouter } from "./api/artists.router.js";
import { gigsRouter } from "./api/gigs.router.js";
import { cronRouter } from "./api/cron.router.js";
import { notificationsRouter } from "./api/notifications.router.js";
import { requireAuth } from "./middleware/require-auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SqliteStore = BetterSqlite3SessionStore(session);
const sessionDb = new BetterSqlite3(path.resolve(__dirname, "../data/sessions.db"));

const app = express();
const isProd = process.env.NODE_ENV === "production";

if (isProd) app.set("trust proxy", 1);

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(
  session({
    store: new SqliteStore({ client: sessionDb }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use("/auth", authRouter);
app.use("/api", cronRouter); // cron has its own auth
app.use(express.json());
app.use("/api", requireAuth, artistsRouter, gigsRouter, notificationsRouter);

app.listen(config.port, () => {
  console.log(`Server listening on http://127.0.0.1:${config.port}`);
});
