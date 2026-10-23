import type { Meta, StoryObj } from "@storybook/react-vite";
import type * as React from "react";

import { PackageCard } from "../components/site-pricing";
import { CARD_LABELS, PACKAGES, START } from "./site-sections.fixtures";

// One flat package on the marketing site (marketing 07, 15). The amount row keeps its height while loading, ready or
// unavailable. A badge makes it the featured card. SAMPLE prices, invented.
const meta: Meta = { title: "Site/PackageCard", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { PackageCard } from "@app/ui/components/site-pricing";' };
export default meta;
type Story = StoryObj;

const [single, mfj] = PACKAGES;
const frame = (node: React.ReactNode) => <div className="w-80 p-8">{node}</div>;

export const Ready: Story = { render: () => frame(<PackageCard {...single!} price={{ status: "ready", amount: single!.amount }} href={START} labels={CARD_LABELS} />) };
export const Featured: Story = { render: () => frame(<PackageCard {...mfj!} price={{ status: "ready", amount: mfj!.amount }} href={START} labels={CARD_LABELS} />) };
export const Loading: Story = { render: () => frame(<PackageCard {...single!} price={{ status: "loading" }} href={START} labels={CARD_LABELS} />) };
// The portal can't be reached: no amount at all, never a stale one.
export const Unavailable: Story = { render: () => frame(<PackageCard {...single!} price={{ status: "unavailable" }} href={START} labels={CARD_LABELS} />) };
