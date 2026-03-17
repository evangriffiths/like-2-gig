import { config } from "./config.js";
import type { Gig } from "./types.js";
import type { NotificationRule } from "./db.js";

interface GigWithArtist extends Gig {
  artistName: string;
}

function gigsUrl(rule: NotificationRule): string {
  const params = new URLSearchParams({
    lat: String(rule.latitude),
    lng: String(rule.longitude),
    radius: String(rule.radiusKm),
    location: rule.locationName,
  });
  if (rule.dateFrom) params.set("dateFrom", rule.dateFrom);
  if (rule.dateTo) params.set("dateTo", rule.dateTo);
  return `${config.clientOrigin}/gigs?${params}`;
}

export async function sendNotificationEmail(
  to: string,
  rule: NotificationRule,
  gigs: GigWithArtist[]
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.warn("[email] No RESEND_API_KEY configured, skipping email");
    return false;
  }

  const viewUrl = gigsUrl(rule);

  const gigLines = gigs.map(
    (g) => `- ${g.artistName} at ${g.venue}, ${g.location} (${g.date.split("T")[0]})`
  ).join("\n");

  const text = `New gigs matching "${rule.label}":\n\n${gigLines}\n\nSee all upcoming gigs: ${viewUrl}`;

  const html = `
    <h2>New gigs matching "${rule.label}"</h2>
    <ul>
      ${gigs.map((g) =>
        `<li><strong>${g.artistName}</strong> at ${g.venue}, ${g.location} — ${g.date.split("T")[0]}
         <a href="${g.songkickUrl}">[Songkick]</a></li>`
      ).join("")}
    </ul>
    <p><a href="${viewUrl}">See all upcoming gigs near ${rule.locationName.split(",")[0]}</a></p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Like2Gig <notifications@like2gig.evangriffiths.org>",
        to,
        subject: `${gigs.length} new gig${gigs.length !== 1 ? "s" : ""} — ${rule.label}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend error (${res.status}):`, body);
      return false;
    }

    console.log(`[email] Sent notification to ${to}: ${gigs.length} gigs for "${rule.label}"`);
    return true;
  } catch (err) {
    console.error("[email] Send failed:", err);
    return false;
  }
}
