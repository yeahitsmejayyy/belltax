import { Banner } from "@app/ui/components/banner";

import { firstName, longDateTime, type ClientPayment } from "./words";

// The last attempt to pay failed (portal 18, desktop 24): what happened and when, what to do about it, and
// that it doesn't hold up the return. The Pay button stays on the invoice below, so there's one primary action.
export function PaymentFailed({ payment, preparer, replyTo }: { payment: ClientPayment; preparer: string; replyTo: string }) {
  return (
    <section aria-label="Payment problem" className="grid gap-4">
      <Banner tone="danger" title="Your payment didn't go through">
        <p>
          {payment.failureMessage ?? "The payment was declined."} You have not been charged. Tried {longDateTime(payment.createdAt)}.
        </p>
      </Banner>
      <div className="grid gap-3 rounded-xl bg-muted p-5">
        <h2 className="font-semibold">What you can do</h2>
        <ol className="grid list-decimal gap-2 pl-5">
          <li>Try again once online payment opens. Sometimes it works the second time.</li>
          <li>Use a different card, or pay {preparer} another way: Zelle, check or cash.</li>
          <li>Call the number on the back of your card. Banks sometimes block a new charge until you confirm it.</li>
        </ol>
        <p className="text-sm text-muted-foreground">
          This doesn't hold up your return. {firstName(preparer)} keeps working while you sort it out. Questions? Write to {replyTo}.
        </p>
      </div>
    </section>
  );
}
