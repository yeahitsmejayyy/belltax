import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn's class-name helper, shared so both apps and the design system (ticket 11) agree on it.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
