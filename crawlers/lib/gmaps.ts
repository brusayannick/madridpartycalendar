/** Google Maps deep link for a venue. */

export function gmapsUrl(venueName: string | null | undefined, city = "Madrid"): string | undefined {
  if (!venueName?.trim()) return undefined;
  const query = `${venueName.trim()}, ${city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
