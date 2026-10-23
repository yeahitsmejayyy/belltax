import { Navigate, useNavigate, useParams } from "react-router-dom";

import { AdminSettingsPage, type SettingsTab } from "@app/ui/components/admin-settings";

import { LetterTab } from "@/components/settings/letter-tab";
import { PracticeTab } from "@/components/settings/practice-tab";
import { PricingTab } from "@/components/settings/pricing-tab";
import { SignInTab } from "@/components/settings/sign-in-tab";
import { usePageTitle } from "@/shell/header-slots";

// Settings (admin 31/32/33-settings): Practice, Services & pricing, Engagement letter, and Sign-in (ticket 05b). The tab is the URL segment,
// so each one can be linked to and survives a reload.

const TABS: SettingsTab[] = [
  { id: "practice", label: "Practice", content: <PracticeTab /> },
  { id: "pricing", label: "Services & pricing", content: <PricingTab /> },
  { id: "letter", label: "Engagement letter", content: <LetterTab /> },
  { id: "sign-in", label: "Sign-in", content: <SignInTab /> },
];

export default function Settings() {
  usePageTitle("Settings");
  const { tab } = useParams();
  const navigate = useNavigate();
  if (tab && !TABS.some((t) => t.id === tab)) return <Navigate to="/settings" replace />;
  const current = tab ?? "practice";

  return <AdminSettingsPage tabs={TABS} value={current} onValueChange={(v) => navigate(v === "practice" ? "/settings" : `/settings/${v}`)} />;
}
