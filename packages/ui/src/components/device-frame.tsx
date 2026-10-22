import type * as React from "react";

import { cn } from "../utils";

// A phone to show phone-only UI in (ticket 56): the body, the camera cut-out and the home bar, at a real device's size.
// The screen is the containing block for `fixed` children, so bottom tabs and floating buttons sit on the phone's
// screen, not the page's; and it reserves the home-bar strip the way iOS does (--safe-bottom, which BottomTabs and
// the floating buttons honour), so nothing sits under the curve of the corners. For Storybook and marketing pages.

export const DEVICES = {
  "iphone-16-pro": { label: "iPhone 16 Pro", width: 402, height: 874, radius: 55, safeTop: 62, safeBottom: 34 },
  "iphone-16-pro-max": { label: "iPhone 16 Pro Max", width: 440, height: 956, radius: 60, safeTop: 62, safeBottom: 34 },
  "pixel-9": { label: "Pixel 9", width: 412, height: 923, radius: 48, safeTop: 48, safeBottom: 24 },
} as const;
export type Device = keyof typeof DEVICES;

export function DeviceFrame({
  device = "iphone-16-pro",
  height,
  className,
  children,
}: {
  device?: Device;
  /** Cut the phone shorter (the screen scrolls), e.g. to fit a Docs page. Defaults to the device's own height. */
  height?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const d = DEVICES[device];
  const bezel = 10;
  return (
    <div
      data-slot="device-frame"
      aria-label={`${d.label} screen`}
      className={cn("relative shrink-0 bg-neutral-900 shadow-2xl ring-1 ring-black/40 dark:bg-neutral-950 dark:ring-white/15", className)}
      style={{ width: d.width + bezel * 2, maxWidth: "100%", height: (height ?? d.height) + bezel * 2, padding: bezel, borderRadius: d.radius + bezel }}
    >
      <div
        data-slot="device-screen"
        className="relative h-full w-full transform-gpu overflow-hidden bg-background text-foreground"
        style={{ borderRadius: d.radius, ["--safe-bottom" as string]: `${d.safeBottom}px`, paddingTop: d.safeTop }}
      >
        <span aria-hidden="true" className="absolute top-3 left-1/2 z-50 h-[34px] w-[124px] -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full overflow-y-auto">{children}</div>
        <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 z-50 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-foreground/80" />
      </div>
    </div>
  );
}
