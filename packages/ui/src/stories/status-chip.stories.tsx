import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import {
  DOCUMENT_STATUS, DocumentChip, INVOICE_STATUS, InvoiceChip, PAYMENT_STATUS, PaymentChip,
  type DocumentChipStatus, type InvoiceChipStatus, type PaymentChipStatus,
} from "../components/status-chip";

const meta: Meta = { title: "Admin/StatusChip" };
export default meta;

const Row = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="grid gap-2">
    <span className="text-xs font-medium text-muted-foreground">{title}</span>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

// The same geometry as the stage pill, for documents, invoices and payments.
export const All: StoryObj = {
  render: () => (
    <div className="grid gap-6">
      <Row title="Documents (portal 13-documents, admin 14-return-documents)">
        {(Object.keys(DOCUMENT_STATUS) as DocumentChipStatus[]).map((s) => <DocumentChip key={s} status={s} />)}
      </Row>
      <Row title="Invoices (admin 29-invoices)">
        {(Object.keys(INVOICE_STATUS) as InvoiceChipStatus[]).map((s) => <InvoiceChip key={s} status={s} />)}
      </Row>
      <Row title="Payments (admin 17-return-billing)">
        {(Object.keys(PAYMENT_STATUS) as PaymentChipStatus[]).map((s) => <PaymentChip key={s} status={s} />)}
      </Row>
    </div>
  )
};
export const AllTest: StoryObj = {
  ...All,
  name: "All · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const chips = [...canvasElement.querySelectorAll('[data-slot="status-chip"]')];
    await expect(chips).toHaveLength(Object.keys(DOCUMENT_STATUS).length + Object.keys(INVOICE_STATUS).length + Object.keys(PAYMENT_STATUS).length);
    for (const c of chips) {
      await expect(c.textContent?.trim().length).toBeGreaterThan(0);
      await expect(c.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    }
  },
};

