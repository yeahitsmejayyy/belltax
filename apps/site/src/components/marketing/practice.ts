import { useNames } from "@/lib/public";

// Copy helpers for the marketing sections. Every practice-specific word comes from useNames().

// New clients are invite-only: the primary action writes to the practice. Until the email loads, it scrolls to prices.
export function useStartHref() {
  const { email } = useNames();
  return email ? `mailto:${email}?subject=${encodeURIComponent("New client")}` : "#pricing";
}

// The tax year a new client would book for: last year's return until filing season ends (May), then this year's.
export function bookingYear(now = new Date()) {
  return now.getMonth() < 4 ? now.getFullYear() - 1 : now.getFullYear();
}

export const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// "CA" → "California"; a full name passes through; unknown → null (the copy says "state").
export function stateName(state: string | null) {
  if (!state) return null;
  return STATES[state.trim().toUpperCase()] ?? (state.trim().length > 2 ? state.trim() : null);
}
