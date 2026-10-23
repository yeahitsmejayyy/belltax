import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, within } from "storybook/test";

import { InvoiceDetailCard, InvoiceScreen, OtherInvoices, PaymentFailed, PaymentReturnBanner, ReceiptDocument, ReceiptView, type ClientInvoice } from "../components/invoice";
import { fnSource } from "./fixtures";
import raw from "./portal-invoice.stories?raw";
import { failed, older, paid, partial, PREPARER, receipt, REPLY_TO, unpaid } from "./portal-letter-invoice.fixtures";

// The client portal's invoice (portal 17 unpaid, 18 failed, 19 paid, 20 receipt; desktop 24): the same components
// apps/portal renders. The app fetches invoices and the receipt, opens Stripe's checkout and prints; these get data
// and callbacks. Invented household and practice.
const meta: Meta = {
  title: "Portal/Invoice",
  parameters: {
    usage: 'import { InvoiceDetailCard, InvoiceScreen, OtherInvoices, PaymentFailed, PaymentReturnBanner, ReceiptDocument, ReceiptView } from "@app/ui/components/invoice";',
  },
};
export default meta;
type Story = StoryObj;

const phone = { viewport: { value: "phone", isRotated: false } };

// The screen as the portal wires it: choose another invoice, pay (when online payment is on), open the receipt.
function InvoicePage({ invoices, online = true, onPay = () => {}, onDownload = () => {} }: { invoices: ClientInvoice[]; online?: boolean; onPay?: (id: string) => void; onDownload?: () => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  const shown = invoices.find((i) => i.id === chosen) ?? invoices[0];
  return (
    <InvoiceScreen
      invoice={shown}
      others={invoices.filter((i) => i.id !== shown?.id)}
      preparer={PREPARER}
      replyTo={REPLY_TO}
      onDismissReturn={() => {}}
      onChoose={setChosen}
      onReceipt={setReceiptFor}
      onPay={online ? onPay : undefined}
      receipt={receiptFor ? <ReceiptView receipt={receipt} open onOpenChange={(o) => !o && setReceiptFor(null)} onDownload={onDownload} /> : null}
    />
  );
}

const page = (invoices: ClientInvoice[], online = true): Story => ({
  render: () => <InvoicePage invoices={invoices} online={online} />,
  globals: phone,
  parameters: { docs: { source: { code: fnSource(raw, "InvoicePage") } } },
});

export const Unpaid: Story = { ...page([unpaid, older]), name: "Unpaid" };
export const UnpaidDesktop: Story = { ...page([unpaid, older]), name: "Unpaid · desktop", globals: {} };
export const OnlinePaymentOff: Story = { ...page([unpaid]), name: "Online payment off", render: () => <InvoicePage invoices={[unpaid]} online={false} /> };
export const Failed: Story = { ...page([failed]), name: "Payment failed" };
export const Partial: Story = { ...page([partial]), name: "Partly paid" };
export const Paid: Story = { ...page([paid]), name: "Paid" };
export const BackFromCheckout: Story = {
  name: "Back from checkout",
  render: () => <InvoiceScreen invoice={paid} preparer={PREPARER} replyTo={REPLY_TO} returnedFromCheckout onDismissReturn={fn()} onChoose={fn()} onReceipt={fn()} />,
  globals: phone,
};
export const NoInvoice: Story = { name: "No invoice yet", render: () => <InvoiceScreen preparer={PREPARER} replyTo={REPLY_TO} onDismissReturn={fn()} onChoose={fn()} onReceipt={fn()} /> };
export const Loading: Story = { name: "Loading", render: () => <InvoiceScreen loading preparer={PREPARER} replyTo={REPLY_TO} onDismissReturn={fn()} onChoose={fn()} onReceipt={fn()} /> };
export const LoadFailed: Story = { name: "Didn't load", render: () => <InvoiceScreen error preparer={PREPARER} replyTo={REPLY_TO} onDismissReturn={fn()} onChoose={fn()} onReceipt={fn()} /> };

export const Card: Story = { name: "InvoiceDetailCard", render: () => <InvoiceDetailCard invoice={unpaid} preparer={PREPARER} onReceipt={fn()} onPay={fn()} /> };
export const CardPaying: Story = { name: "InvoiceDetailCard · opening checkout", render: () => <InvoiceDetailCard invoice={unpaid} preparer={PREPARER} onReceipt={fn()} onPay={fn()} paying /> };
export const Failure: Story = { name: "PaymentFailed", render: () => <PaymentFailed payment={failed.payments[0]!} preparer={PREPARER} replyTo={REPLY_TO} /> };
export const Returned: Story = { name: "PaymentReturnBanner", render: () => <PaymentReturnBanner received={false} onDismiss={fn()} /> };
export const Others: Story = { name: "OtherInvoices", render: () => <OtherInvoices invoices={[older, paid]} onChoose={fn()} /> };
export const Receipt: Story = { name: "ReceiptDocument", render: () => <ReceiptDocument r={receipt} /> };
export const ReceiptLoading: Story = { name: "ReceiptView · loading", render: () => <ReceiptView loading open onOpenChange={() => {}} onDownload={fn()} /> };

const paid1 = fn();
const download = fn();
export const PayAndReceiptTest: Story = {
  name: "Pay and receipt · test",
  tags: ["!dev", "!autodocs"],
  render: () => <InvoicePage invoices={[partial, older]} onPay={paid1} onDownload={download} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    paid1.mockClear();
    download.mockClear();
    await userEvent.click(c.getByRole("button", { name: "Pay $225.00" }));
    await expect(paid1).toHaveBeenCalledWith(partial.id);
    // The receipt opens; "Download PDF" asks the app to print.
    await userEvent.click(c.getByRole("button", { name: /View receipt/ }));
    await expect(await screen.findByRole("article", { name: "Receipt R-2026-0031" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Download PDF/ }));
    await expect(download).toHaveBeenCalledOnce();
    await userEvent.keyboard("{Escape}");
    // Another invoice: choosing it shows it.
    await userEvent.click(c.getByRole("button", { name: /Invoice 2025-0012/ }));
    await expect(c.getByText("Invoice 2025-0012", { selector: "p" })).toBeInTheDocument();
  },
};

export const PaymentOffTest: Story = {
  name: "Online payment off · test",
  tags: ["!dev", "!autodocs"],
  render: () => <InvoicePage invoices={[unpaid]} online={false} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("button", { name: "Pay $425.00" })).toBeDisabled();
    await expect(c.getByText(/Online payment opens soon/)).toBeInTheDocument();
  },
};
