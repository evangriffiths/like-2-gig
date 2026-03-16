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
  for (const userId of userIds) {
    runSync(userId);
  }

  res.json({ ok: true, usersQueued: userIds.length });
});
