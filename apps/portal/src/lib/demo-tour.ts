import { useState } from "react";
import { trpc } from "@/lib/trpc";

// The hosted public demo (DEMO_PUBLIC): the front door, the demo bar and the "Try this" hints appear only when the
// server says so. Live mode answers NOT_FOUND, local demo answers publicDemo: false; both show nothing.
export function useDemoTour() {
  const tour = trpc.demo.tour.useQuery(undefined, { retry: false, staleTime: Infinity });
  return tour.data?.publicDemo ? tour.data : null;
}

// Hints the visitor dismissed, remembered in this browser only.
export function useDismissed(key: string): [boolean, () => void] {
  const storageKey = `btp-demo-tips-${key}`;
  const read = () => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  };
  const [hidden, setHidden] = useState(read);
  return [
    hidden,
    () => {
      setHidden(true);
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
    },
  ];
}
