// The splash page's words (ticket 53, from PJ's design export): a placeholder while the practice gets ready, with no call
// to action (invite-only, PJ 2026-10-20). City and state come in from useNames(); the points are the landing page's.

export { sellingPoints } from "./landing";

const nb = "\u00a0";

/** When the practice opens: the one date the splash states outright. */
export const OPENING = "January 2027";

export function splashCopy({ city, region }: { city: string | null; region: string | null }) {
  return {
    badge: `Opening ${OPENING}${city ? ` · ${city}` : ""}`,
    title: "Taxes Made Easy.",
    lead: `Federal and ${region ?? "state"} returns, prepared and e-filed by our team, with every step in one place on your${nb}phone.`,
  };
}
