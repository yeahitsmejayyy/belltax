import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { SunIcon } from "./ui/sun";
import { MoonIcon } from "./ui/moon";

type ModeToggleProps = {
    variant?: "dropdown" | "switch";
};

export function ModeToggle({
    variant = "dropdown",
}: ModeToggleProps) {
    const { theme, setTheme } = useTheme();

    // --- SWITCH VARIANT (light / dark only) ---
    if (variant === "switch") {
        const isDark = theme === "dark";

        return (
            <Switch
                checked={isDark}
                onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                }
                aria-label="Toggle theme"
            />
        );
    }

    // --- DROPDOWN VARIANT (light / dark / system) ---
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="relative hover:cursor-pointer"
                >
                    <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                    <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
