import {
  getNotificationRules, getCachedLikedArtists, getCachedGigs,
  getGigsByUrls, getUserEmail, addNotificationLog,
  type LocationFilter,
} from "./db.js";
import { sendNotificationEmail } from "./email.js";

/**
 * Evaluate notification rules for a user after sync.
 * `newGigUrls` is the set of songkick_urls that were added during this sync.
 */
export async function evaluateNotifications(
  userId: string,
  newGigUrls: string[]
): Promise<void> {
  if (newGigUrls.length === 0) return;

  const rules = getNotificationRules(userId);
  if (rules.length === 0) return;

  const email = getUserEmail(userId);
  if (!email) {
    console.warn(`[notify] No email for user ${userId}, skipping notifications`);
    return;
  }

  // Get full details for new gigs
  const newGigs = getGigsByUrls(newGigUrls);
  if (newGigs.length === 0) return;

  // Get user's liked artist IDs for filtering
  const likedArtists = getCachedLikedArtists(userId);
  const likedArtistIds = new Set(likedArtists.map((a) => a.id));

  for (const rule of rules) {
    // Filter new gigs by this rule's criteria
    const matching = newGigs.filter((gig) => {
      // Must be from a liked artist (check via artist name match in gigs table)
      // gig data is shared, but we only care about this user's artists
      // We already got gigs from the user's artists via newGigUrls

      // Location filter
      if (gig.latitude == null || gig.longitude == null) return false;
      const R = 6371;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(gig.latitude - rule.latitude);
      const dLon = toRad(gig.longitude - rule.longitude);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(rule.latitude)) * Math.cos(toRad(gig.latitude)) * Math.sin(dLon / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist > rule.radiusKm) return false;

      // Date filter
      const d = gig.date.split("T")[0];
      if (rule.dateFrom && d < rule.dateFrom) return false;
      if (rule.dateTo && d > rule.dateTo) return false;

      return true;
    });

    if (matching.length === 0) continue;

    const sent = await sendNotificationEmail(email, rule.label, matching);
    if (sent) {
      addNotificationLog(rule.id, matching.length);
    }
  }
}
