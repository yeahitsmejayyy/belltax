import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/card";
import { InvoiceChip } from "../components/status-chip";

const meta: Meta<typeof Card> = { title: "Primitives/Card", component: Card };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { Button } from \"@app/ui/components/button\";\nimport { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from \"@app/ui/components/card\";\nimport { InvoiceChip } from \"@app/ui/components/status-chip\";" };
export default meta;

export const Invoice: StoryObj<typeof Card> = {
  render: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Invoice 2026-0014</CardTitle>
        <CardDescription>Federal and California returns, tax year 2025</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <span className="font-mono text-2xl font-semibold tabular">$340.00</span>
        <InvoiceChip status="unpaid" />
      </CardContent>
      <CardFooter>
        <Button size="touch" className="w-full">Pay $340.00</Button>
      </CardFooter>
    </Card>
  ),
};
