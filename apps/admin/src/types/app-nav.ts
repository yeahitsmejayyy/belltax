import type { LucideIcon } from "lucide-react";

export type AppNavItem = {
    id: string;
    label: string;
    to: string;
    icon: LucideIcon;
    tooltip?: string;
    disabled?: boolean;
};

export type AppNavSection = {
    id: string;
    items: AppNavItem[];
};
