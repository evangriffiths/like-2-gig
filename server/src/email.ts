import { config } from "./config.js";
import type { Gig } from "./types.js";

interface GigWithArtist extends Gig {
  artistName: string;
}

export async function sendNotificationEmail(
  to: string,
  ruleLabel: string,
  gigs: GigWithArtist[]
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.warn("[email] No RESEND_API_KEY configured, skipping email");
    return false;
  }

  const gigLines = gigs.map(
    (g) => `- ${g.artistName} at ${g.venue}, ${g.location} (${g.date.split("T")[0]})`
  ).join("\n");

  const text = `New gigs matching "${ruleLabel}":\n\n${gigLines}\n\nView all gigs: ${config.clientOrigin}/gigs`;

  const html = `
    <h2>New gigs matching "${ruleLabel}"</h2>
    <ul>
      ${gigs.map((g) =>
        `<li><strong>${g.artistName}</strong> at ${g.venue}, ${g.location} — ${g.date.split("T")[0]}
         <a href="${g.songkickUrl}">[Songkick]</a></li>`
      ).join("")}
    </ul>
    <p><a href="${config.clientOrigin}/gigs">View all gigs</a></p>
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
        subject: `${gigs.length} new gig${gigs.length !== 1 ? "s" : ""} — ${ruleLabel}`,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend error (${res.status}):`, body);
      return false;
    }

    console.log(`[email] Sent notification to ${to}: ${gigs.length} gigs for "${ruleLabel}"`);
    return true;
  } catch (err) {
    console.error("[email] Send failed:", err);
    return false;
  }
}
