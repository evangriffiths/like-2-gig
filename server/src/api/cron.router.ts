import { Router } from "express";
import { config } from "../config.js";
import { getAllUserIds } from "../db.js";
import { runSync } from "../sync.js";

export const cronRouter = Router();

cronRouter.post("/cron/sync", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!config.cronSecret || authHeader !== `Bearer ${config.cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userIds = getAllUserIds();

  // Chain syncs in series to avoid overwhelming Songkick
  (async () => {
    for (const userId of userIds) {
      await runSync(userId);
    }
    console.log(`[cron] Finished syncing ${userIds.length} users`);
  })();

  res.json({ ok: true, usersQueued: userIds.length });
});
