import type { Gig } from "../types.js";

const BASE_URL = "https://www.songkick.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (res.status === 429) {
    throw new Error(`Songkick rate limited: ${url}`);
  }
  if (!res.ok) {
    throw new Error(`Songkick fetch failed (${res.status}): ${url}`);
  }
  return res.text();
}

/**
 * Search Songkick for an artist by name and return the first matching
 * artist's path (e.g. "/artists/29315-foo-fighters"), or null if not found.
 */
export async function searchArtist(
  name: string
): Promise<string | null> {
  const params = new URLSearchParams({ utf8: "✓", query: name });
  const html = await fetchPage(`${BASE_URL}/search?${params}`);

  // Match the first artist result link: <a href="/artists/29315-foo-fighters" ... class="search-link">
  const match = html.match(
    /<a\s+href="(\/artists\/\d+-[^"]+)"[^>]*class="search-link"/
  );
  return match ? match[1] : null;
}

/**
 * Fetch upcoming gigs for an artist from their Songkick page.
 * Only parses JSON-LD from the "coming-up" section, ignoring past events.
 * Deduplicates by songkickUrl.
 */
export async function fetchArtistGigs(
  artistPath: string
): Promise<Gig[]> {
  const html = await fetchPage(`${BASE_URL}${artistPath}`);

  // Extract only the "coming up" section
  const comingUpStart = html.indexOf('id="coming-up"');
  const pastEventsStart = html.indexOf('id="past-events"');
  if (comingUpStart === -1) return [];

  const comingUpHtml =
    pastEventsStart > comingUpStart
      ? html.slice(comingUpStart, pastEventsStart)
      : html.slice(comingUpStart);

  // Extract JSON-LD blocks from the coming-up section only
  const jsonLdPattern =
    /<script\s+type="application\/ld\+json">\s*(\[.*?\])\s*<\/script>/gs;
  const seen = new Set<string>();
  const gigs: Gig[] = [];

  let jsonMatch;
  while ((jsonMatch = jsonLdPattern.exec(comingUpHtml)) !== null) {
    try {
      const events = JSON.parse(jsonMatch[1]);
      for (const event of events) {
        if (event["@type"] !== "MusicEvent") continue;

        const url: string = event.url || "";
        // Strip UTM params for dedup key
        const dedupKey = url.split("?")[0];
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const location = event.location;
        const address = location?.address;

        const locationParts = [
          address?.addressLocality,
          address?.addressRegion,
          address?.addressCountry,
        ].filter(Boolean);

        const geo = location?.geo;
        gigs.push({
          location: locationParts.join(", "),
          venue: location?.name || "Unknown venue",
          date: event.startDate || "",
          songkickUrl: url,
          latitude: geo?.latitude != null ? Number(geo.latitude) : null,
          longitude: geo?.longitude != null ? Number(geo.longitude) : null,
        });
      }
    } catch {
      // Skip malformed JSON-LD blocks
    }
  }

  return gigs;
}
