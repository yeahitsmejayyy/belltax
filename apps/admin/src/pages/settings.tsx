import { Navigate, useNavigate, useParams } from "react-router-dom";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@app/ui/components/tabs";

import { LetterTab } from "@/components/settings/letter-tab";
import { PracticeTab } from "@/components/settings/practice-tab";
import { PricingTab } from "@/components/settings/pricing-tab";
import { SignInTab } from "@/components/settings/sign-in-tab";
import { usePageTitle } from "@/shell/header-slots";

// Settings (admin 31/32/33-settings): Practice, Services & pricing, Engagement letter, and Sign-in (ticket 05b). The tab is the URL segment,
// so each one can be linked to and survives a reload.

const TABS = [
  { id: "practice", label: "Practice" },
  { id: "pricing", label: "Services & pricing" },
  { id: "letter", label: "Engagement letter" },
  { id: "sign-in", label: "Sign-in" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function Settings() {
  usePageTitle("Settings");
  const { tab } = useParams();
  const navigate = useNavigate();
  if (tab && !TABS.some((t) => t.id === tab)) return <Navigate to="/settings" replace />;
  const current = (tab ?? "practice") as Tab;

  return (
    <Tabs value={current} onValueChange={(v) => navigate(v === "practice" ? "/settings" : `/settings/${v}`)} className="animate-page gap-6">
      <TabsList aria-label="Settings">
        {TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="max-md:min-h-11">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="practice">
        <PracticeTab />
      </TabsContent>
      <TabsContent value="pricing">
        <PricingTab />
      </TabsContent>
      <TabsContent value="letter">
        <LetterTab />
      </TabsContent>
      <TabsContent value="sign-in">
        <SignInTab />
      </TabsContent>
    </Tabs>
  );
}
