import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { CircleCheck, X } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
export function HealthStatusWidget() {
    const healthCheck = trpc.health.check.useQuery();
    const status = healthCheck.data?.status;

    const badgeClasses = cn(
        "capitalize",
        status === "ok"
            ? "bg-emerald-700 text-emerald-50"
            : "bg-red-500 text-red-50"
    );


    return (
        <Card className="max-w-md">
            <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                    System Health
                </CardTitle>
                {status ? (
                    <Badge className={badgeClasses}>
                        {status}
                    </Badge>
                ) : (
                    <Badge variant={'destructive'}>
                        Failed
                    </Badge>
                )}


            </CardHeader>

            <CardContent>
                {healthCheck.isLoading && (
                    <div className="flex flex-col gap-y-3">
                        <Skeleton className="h-4 w-[33%]" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                    // <p className="text-sm text-muted-foreground">
                    //     Checking backend health…
                    // </p>
                )}

                {healthCheck.error && (
                    <div className="flex items-center justify-center rounded-sm bg-muted px-3 py-6">
                        <div className="flex items-center justify-center flex-col gap-y-1">
                            <X className="text-red-600" />
                            <p className="text-muted-foreground">Backend Not Connected</p>
                        </div>
                    </div>
                )}

                {healthCheck.data && (
                    <div className="flex items-center justify-center rounded-sm bg-muted px-3 py-6">
                        <div className="flex items-center justify-center flex-col gap-y-1">
                            <CircleCheck className="text-green-600" />
                            <p className="text-muted-foreground">Backend Is Connected</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
