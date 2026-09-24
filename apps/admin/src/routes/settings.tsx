import { AppToolbar } from "@/components/layout/app-toolbar";

export function Settings() {
    return (
        <>
            <AppToolbar
                breadcrumbs={[
                    { label: "Home", href: "/dashboard" },
                    { label: "Settings" },
                ]}
            />

            <main className="flex-1 p-6">
                <div className="h-full rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Settings content</p>
                </div>
            </main>
        </>
    );
}
