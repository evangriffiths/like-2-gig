import { Router } from "express";
import { getNotificationRules, createNotificationRule, deleteNotificationRule } from "../db.js";

export const notificationsRouter = Router();

notificationsRouter.get("/notifications", async (req, res) => {
  const userId = req.session.userId!;
  const rules = getNotificationRules(userId);
  res.json({ rules });
});

notificationsRouter.post("/notifications", async (req, res) => {
  const userId = req.session.userId!;
  const { label, latitude, longitude, locationName, radiusKm, dateFrom, dateTo } = req.body;

  if (!label || latitude == null || longitude == null || !locationName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const id = createNotificationRule(userId, {
    label,
    latitude: Number(latitude),
    longitude: Number(longitude),
    locationName,
    radiusKm: Number(radiusKm) || 50,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const rules = getNotificationRules(userId);
  res.json({ id, rules });
});

notificationsRouter.delete("/notifications/:id", async (req, res) => {
  const userId = req.session.userId!;
  const ruleId = Number(req.params.id);
  const deleted = deleteNotificationRule(userId, ruleId);

  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const rules = getNotificationRules(userId);
  res.json({ rules });
});
