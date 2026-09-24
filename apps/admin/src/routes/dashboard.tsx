import { AppToolbar } from "@/components/layout/app-toolbar";

export function Dashboard() {
    return (
        <>
            <AppToolbar
                breadcrumbs={[
                    { label: "Home", href: "/" },
                    { label: "Dashboard" },
                ]}
            />

            <main className="flex-1 p-6">
                <div className="h-full rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Dashboard content</p>
                </div>
            </main>
        </>
    );
}
