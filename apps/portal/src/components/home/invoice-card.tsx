import { CircleDashed, Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@app/ui/components/button";
import { Card, CardContent } from "@app/ui/components/card";
import { Money } from "@app/ui/components/money";
import { INVOICE_STATUS, StatusChip } from "@app/ui/components/status-chip";
import { formatDate } from "@app/ui/format";

import type { RouterOutputs } from "@/lib/trpc";

// The invoice on the home screen (portal 05-home, desktop 22): what's owed, its state, and the way to it.

type Invoice = RouterOutputs["invoice"]["list"][number];

function chipFor(inv: Invoice) {
  if (inv.settlement !== "unpaid") return INVOICE_STATUS[inv.settlement];
  if (!inv.dueOn) return { tone: "neutral" as const, icon: CircleDashed, label: "Due before filing" };
  const due = `${inv.dueOn}T12:00:00Z`;
  if (inv.dueOn < new Date().toISOString().slice(0, 10)) return { ...INVOICE_STATUS.overdue, label: `Overdue since ${formatDate(due, { month: "short", day: "numeric" })}` };
  return { tone: "brand" as const, icon: Clock, label: `Due ${formatDate(due, { month: "short", day: "numeric" })}` };
}

export function InvoiceCard({ invoice, preparer }: { invoice: Invoice; preparer: string }) {
  const cents = invoice.settlement === "paid" ? invoice.totalCents : invoice.balanceCents;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm text-muted-foreground">Invoice from {preparer}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Money cents={cents} className="text-2xl font-semibold" />
            <StatusChip {...chipFor(invoice)} />
          </div>
        </div>
        <Button asChild variant="outline" size="touch">
          <Link to="/invoice">View invoice</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
