import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbItemType = {
    label: string;
    href?: string;
};

type AppBreadcrumbProps = {
    items: BreadcrumbItemType[];
};

export function AppBreadcrumb({ items }: AppBreadcrumbProps) {
    if (!items.length) return null;

    return (
        <div className="px-6 py-4">
            <Breadcrumb>
                <BreadcrumbList>
                    {items.map((item, index) => {
                        const isLast = index === items.length - 1;

                        return (
                            <BreadcrumbItem key={index}>
                                {item.href && !isLast ? (
                                    <BreadcrumbLink href={item.href}>
                                        {item.label}
                                    </BreadcrumbLink>
                                ) : (
                                    <BreadcrumbPage>
                                        {item.label}
                                    </BreadcrumbPage>
                                )}

                                {!isLast && <BreadcrumbSeparator />}
                            </BreadcrumbItem>
                        );
                    })}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    );
}
