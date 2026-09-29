import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from "@app/ui/components/sidebar";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { KanbanSquare, LayoutDashboard } from "lucide-react";
import type { AppNavSection } from "@/types/app-nav";
import { clearDemoUser } from "@app/ui/demo";

import { UserMenu } from "./user-menu";
import { useSidebar } from "@app/ui/components/sidebar";
import { useEffect, useState } from "react";


type AppNavProps = {
    variant?: "default" | "icon";
};


export function AppNav({ variant = "default" }: AppNavProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { state, setOpenMobile } = useSidebar();
    const [showText, setShowText] = useState(state === "expanded");

    useEffect(() => {
        setOpenMobile(false);
    }, [location.pathname]);

    const APP_NAV: AppNavSection[] = [
        {
            id: "main",
            items: [
                {
                    id: "pipeline",
                    label: "Pipeline",
                    to: "/pipeline",
                    icon: KanbanSquare,
                    tooltip: "Pipeline",
                },
                {
                    id: "dashboard",
                    label: "Dashboard",
                    to: "/dashboard",
                    icon: LayoutDashboard,
                    tooltip: "Dashboard",
                }
            ],
        },
    ];


    useEffect(() => {
        if (state === "expanded") {
            const t = setTimeout(() => setShowText(true), 150);
            return () => clearTimeout(t);
        } else {
            // collapse: hide immediately
            setShowText(false);
        }
    }, [state]);


    return (
        <Sidebar collapsible={variant === "icon" ? "icon" : "offcanvas"}>
            <SidebarHeader className="h-14 flex justify-center px-4 border-b">
                <NavLink
                    to="/pipeline"
                    className="
      flex items-center gap-3
      hover:opacity-60
      transition-colors
    "
                    aria-label="Go to dashboard"
                >
                    <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-md border">
                        💀
                    </span>

                    {showText && (
                        <span
                            className="
      font-semibold
      animate-in
      fade-in
      slide-in-from-left-1
      duration-200
    "
                        >
                            Bell Tax Prep
                        </span>
                    )}



                </NavLink>
            </SidebarHeader>

            <SidebarContent
                className="
    p-4
    group-data-[collapsible=icon]:p-4
  "
            >

                <SidebarMenu>
                    {APP_NAV.map((section) =>
                        section.items.map((item) => {
                            const Icon = item.icon;

                            return (
                                <SidebarMenuItem key={item.id}>
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={item.tooltip}
                                        disabled={item.disabled}
                                    >
                                        <NavLink
                                            to={item.to}
                                            className="
                flex items-center gap-2
                pl-2 pr-4
                group-data-[collapsible=icon]:pl-4
                group-data-[collapsible=icon]:pr-0
              "
                                        >
                                            <Icon className="h-4 w-4 shrink-0" />

                                            {showText && (
                                                <span
                                                    className="
                    animate-in
                    fade-in
                    slide-in-from-left-1
                    duration-200
                  "
                                                >
                                                    {item.label}
                                                </span>
                                            )}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })
                    )}
                </SidebarMenu>

            </SidebarContent>

            <SidebarFooter
                className="
                border-t
    p-[16px]
    group-data-[collapsible=icon]:pl-[16px]
  "
            >
                <UserMenu
                    username="Demo preparer"
                    email="preparer@belltaxprep.test"
                    avatarSrc="/avatar.png"
                    onSettings={() => navigate("/settings")}
                    onLogout={() => {
                        clearDemoUser("admin");
                        navigate("/login");
                    }}
                />
            </SidebarFooter>

        </Sidebar>
    );
}
