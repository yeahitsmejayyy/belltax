import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

type BreadcrumbItemType = {
    label: string;
    href?: string;
};

interface AppToolbarProps {
    title?: string;
    breadcrumbs?: BreadcrumbItemType[];
}

export function AppToolbar({ title, breadcrumbs }: AppToolbarProps) {
    return (
        <header className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger />

                {breadcrumbs && breadcrumbs.length > 0 && (
                    <>
                        <Separator orientation="vertical" className="h-4" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                {breadcrumbs.map((item, index) => {
                                    const isLast = index === breadcrumbs.length - 1;
                                    return (
                                        <BreadcrumbItem key={index}>
                                            {item.href && !isLast ? (
                                                <BreadcrumbLink href={item.href}>
                                                    {item.label}
                                                </BreadcrumbLink>
                                            ) : (
                                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                                            )}
                                            {!isLast && <BreadcrumbSeparator />}
                                        </BreadcrumbItem>
                                    );
                                })}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </>
                )}

                {!breadcrumbs && title && (
                    <>
                        <Separator orientation="vertical" className="h-4" />
                        <h1 className="text-sm font-medium">{title}</h1>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2">
                {/* Right-side actions later */}
            </div>
        </header>
    );
}
