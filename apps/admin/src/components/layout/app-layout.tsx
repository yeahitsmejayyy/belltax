import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppNav } from "./app-nav";

export function AppLayout() {
    return (
        <SidebarProvider>
            <div className="w-full flex h-svh">
                <AppNav variant="icon" />

                <SidebarInset className="flex flex-col">
                    <Outlet />
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}
