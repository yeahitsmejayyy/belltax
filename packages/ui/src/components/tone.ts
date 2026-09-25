// The six tones every pill and chip uses (principles.md rule 6: never colour alone, always with an
// icon and a word). Each is a subtle fill with its own foreground, so text meets 4.5:1 in both themes.
export type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-transparent text-foreground",
  brand: "border-transparent bg-brand-subtle text-brand-subtle-foreground",
  info: "border-transparent bg-info-subtle text-info-foreground",
  success: "border-transparent bg-success-subtle text-success-foreground",
  warning: "border-transparent bg-warning-subtle text-warning-foreground",
  danger: "border-transparent bg-danger-subtle text-danger-foreground",
};
