import { Stage } from "@app/schema";
import { FilePlus2, ReceiptText, Users } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { EfileCard } from "../components/efile-card";
import { ReturnActivity } from "../components/return-activity";
import { ReturnHeader } from "../components/return-header";
import { ReturnIntake } from "../components/return-intake";
import { ReturnOverview } from "../components/return-overview";
import { ReturnLoading, ReturnNotFound, ReturnPage, type ReturnTab } from "../components/return-page";
import { StageMoveDialog, type StageMoveDraft } from "../components/stage-move-dialog";
import {
  EFILE_MIXED,
  EVENTS,
  INTAKE_SECTIONS,
  INTAKE_SUBMITTED,
  INVOICE,
  INVOICE_FAILED,
  OPEN_REQUESTS,
  PEOPLE,
  PEOPLE_SINGLE,
  RETURN_FILED,
  RETURN_PREPARING,
  type ReturnFixture,
} from "./admin-return.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-return-page.stories?raw";

// One return in the preparer admin (admin 12–18-return-detail, 37-phone-m-return), the same frame
// apps/admin/src/pages/return/return-page.tsx renders: the header, then a tab per job, as a config array with counts.
// The admin keeps the open tab in the URL and fills Documents, Letter and Billing with their own screens; here those
// three are placeholders and the "server" is local state. Invented data.
const meta: Meta<typeof ReturnPage> = {
  title: "Admin/Return/ReturnPage",
  component: ReturnPage,
  parameters: { usage: 'import { ReturnPage, ReturnLoading, ReturnNotFound, type ReturnTab } from "@app/ui/components/return-page";' },
};
export default meta;
type Story = StoryObj<typeof ReturnPage>;

const moved = fn();
const requested = fn();

type Tab = "overview" | "intake" | "documents" | "letter" | "billing" | "activity";

function ReturnScreen({ ret, filed = false, toReview = 0, paymentFailed = false }: { ret: ReturnFixture; filed?: boolean; toReview?: number; paymentFailed?: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stage, setStage] = useState<Stage>(ret.stage);
  const [move, setMove] = useState<StageMoveDraft | null>(null);
  const [reason, setReason] = useState("");
  const moving = stage === ret.stage;
  const at = Stage.options.indexOf(stage);
  const placeholder = (what: string) => <p className="text-sm text-muted-foreground">{what} is its own screen in the admin.</p>;

  const tabs: ReturnTab<Tab>[] = [
    {
      value: "overview",
      label: "Overview",
      content: (
        <ReturnOverview
          stage={stage}
          nextStage={moving ? ret.nextStage : (Stage.options[at + 1] ?? null)}
          blockers={moving ? ret.blockers : []}
          requests={filed ? [] : OPEN_REQUESTS}
          invoice={paymentFailed ? INVOICE_FAILED : INVOICE}
          people={filed ? PEOPLE_SINGLE : PEOPLE}
          efile={filed ? <EfileCard filings={EFILE_MIXED} canRecord={stage === "filed"} onSubmit={() => {}} onAccept={() => {}} onReject={async () => {}} /> : null}
          onRequest={requested}
          onBilling={() => setTab("billing")}
        />
      ),
    },
    { value: "intake", label: "Intake", content: <ReturnIntake sections={INTAKE_SECTIONS} intake={INTAKE_SUBMITTED} /> },
    { value: "documents", label: "Documents", count: toReview, countLabel: "to review", content: placeholder("Documents") },
    { value: "letter", label: "Letter", content: placeholder("The engagement letter") },
    { value: "billing", label: "Billing", alert: paymentFailed ? "A payment failed" : null, content: placeholder("Billing") },
    { value: "activity", label: "Activity", content: <ReturnActivity events={EVENTS} /> },
  ];

  return (
    <ReturnPage
      header={
        <ReturnHeader
          name={ret.name}
          subtitle={ret.subtitle}
          stage={stage}
          daysInStage={moving ? ret.daysInStage : 0}
          nextStage={moving ? ret.nextStage : (Stage.options[at + 1] ?? null)}
          previousStage={moving ? ret.previousStage : (Stage.options[at - 1] ?? null)}
          onMove={(to) => (setReason(""), setMove({ name: ret.name, from: stage, to }))}
          actions={[
            { id: "request", label: "Request a document…", icon: FilePlus2, onSelect: requested },
            { id: "invoice", label: "Create invoice…", icon: ReceiptText, onSelect: () => setTab("billing") },
            { id: "household", label: "Open household", icon: Users, onSelect: () => {} },
          ]}
          dialog={
            <StageMoveDialog
              move={move}
              reason={reason}
              onReasonChange={setReason}
              onCancel={() => setMove(null)}
              onConfirm={() => {
                moved(move?.to);
                if (move) setStage(move.to);
                setMove(null);
              }}
            />
          }
        />
      }
      tabs={tabs}
      value={tab}
      onValueChange={setTab}
    />
  );
}

const source = { docs: { source: { code: fnSource(raw, "ReturnScreen") } } };

export const Preparing: Story = { render: () => <ReturnScreen ret={RETURN_PREPARING} toReview={2} />, parameters: source };
export const Filed: Story = { name: "Filed, a payment failed", render: () => <ReturnScreen ret={RETURN_FILED} filed paymentFailed />, parameters: source };
export const Loading: Story = { render: () => <ReturnLoading /> };
export const NotFound: Story = { name: "Not found", render: () => <ReturnNotFound /> };

export const PreparingTest: Story = {
  ...Preparing,
  name: "Preparing · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    moved.mockClear();
    await expect(c.getByRole("tab", { name: "Documents 2 to review" })).toBeInTheDocument();
    await step("switching tabs", async () => {
      await userEvent.click(c.getByRole("tab", { name: "Intake" }));
      await expect(c.getByRole("tab", { name: "Intake" })).toHaveAttribute("aria-selected", "true");
      await expect(c.getByText("$14,400.00")).toBeInTheDocument();
      await userEvent.click(c.getByRole("tab", { name: "Activity" }));
      await expect(c.getByText("rejected a document")).toBeInTheDocument();
      await userEvent.click(c.getByRole("tab", { name: "Overview" }));
      await userEvent.click(c.getByRole("button", { name: "View billing" }));
      await expect(c.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true");
      await userEvent.click(c.getByRole("tab", { name: "Overview" }));
    });
    await step("advancing the stage from the header", async () => {
      await userEvent.click(c.getByRole("button", { name: "Advance to Client review" }));
      const dialog = await screen.findByRole("dialog", { name: "Advance to Client review?" });
      await userEvent.click(within(dialog).getByRole("button", { name: "Advance to Client review" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await expect(moved).toHaveBeenCalledWith("review");
      await expect(c.getByText("What's needed before it moves to Filed.")).toBeInTheDocument();
    });
  },
};

export const FiledTest: Story = {
  ...Filed,
  name: "Filed · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("tab", { name: "Billing ! A payment failed" })).toBeInTheDocument();
    await expect(c.getByText("E-file")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Submit again" })).toBeInTheDocument();
  },
};
