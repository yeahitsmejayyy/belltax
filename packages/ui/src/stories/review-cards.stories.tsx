import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ReviewCards, type ReviewQuote } from "../components/review-cards";

const meta: Meta = {
  title: "Marketing/Review cards",
  parameters: {
    docs: {
      description: {
        component:
          "Client quotes (marketing 09-desktop-reviews). The quotes below are invented samples: do not ship them. The site leaves this section out until there are real quotes, published with each client's consent.",
      },
    },
  },
};
export default meta;

// Invented samples. Nothing here is real, and none of it goes on the site.
const SAMPLE_QUOTES: ReviewQuote[] = [
  { quote: "I did the whole thing on my lunch breaks. Took pictures of my W-2 and paystubs, signed, and that was it.", name: "Toni Wren", detail: "IHSS caregiver · sample" },
  { quote: "I always knew where it stood. No calling around to ask if they got my forms.", name: "Dana Marigold", detail: "Married, two kids · sample" },
  { quote: "The price was on the site and that’s what I paid. Everything was explained in normal words.", name: "Sidney Kestrel", detail: "Head of household · sample" },
];

export const Samples: StoryObj = {
  render: () => (
    <div className="grid max-w-6xl gap-4">
      <ReviewCards quotes={SAMPLE_QUOTES} />
      <p className="text-center text-xs text-muted-foreground">Sample quotes. Names are invented.</p>
    </div>
  ),
};
export const SamplesTest: StoryObj = {
  ...Samples,
  name: "Samples · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const figures = [...canvasElement.querySelectorAll('[data-slot="review-cards"] figure')];
    await expect(figures).toHaveLength(SAMPLE_QUOTES.length);
    await expect(figures[0]?.querySelector("blockquote")?.textContent).toContain(SAMPLE_QUOTES[0]!.quote);
    await expect(figures[0]?.querySelector('[aria-hidden="true"]')?.textContent).toBe("TW");
  },
};
