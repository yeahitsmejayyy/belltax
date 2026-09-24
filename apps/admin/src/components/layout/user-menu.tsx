import { MoreVertical, LogOut, Settings, SunMoon } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";

type UserMenuProps = {
    username: string;
    email: string;
    avatarSrc?: string;
    onLogout?: () => void;
    onSettings?: () => void;
};

function UserMenuContent({
    onSettings,
    onLogout,
}: {
    onSettings?: () => void;
    onLogout?: () => void;
}) {
    return (
        <>
            <button
                onClick={onSettings}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
                <Settings className="h-4 w-4" />
                Settings
            </button>

            <div className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted">
                <div className="flex items-center gap-2">
                    <SunMoon className="h-4 w-4" />
                    Dark Mode
                </div>
                <ModeToggle variant="switch" />
            </div>

            <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-500 hover:bg-muted"
            >
                <LogOut className="h-4 w-4" />
                Logout
            </button>
        </>
    );
}

export function UserMenu({
    username,
    email,
    avatarSrc,
    onLogout,
    onSettings,
}: UserMenuProps) {
    return (
        <div className="flex items-center justify-between gap-2 w-full">
            {/* Identity (expanded mode only) */}
            <div className="flex items-center gap-x-2 overflow-hidden group-data-[collapsible=icon]:hidden">
                <Avatar className="h-8 w-8 shrink-0">
                    {avatarSrc ? <AvatarImage src={avatarSrc} /> : null}
                    <AvatarFallback>
                        {username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col leading-tight truncate">
                    <p className="text-xs font-semibold truncate">
                        @{username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                        {email}
                    </p>
                </div>
            </div>

            {/* Ellipsis popover — expanded mode */}
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 group-data-[collapsible=icon]:hidden"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="p-2 w-60" align="end" side="right">
                    <UserMenuContent
                        onSettings={onSettings}
                        onLogout={onLogout}
                    />
                </PopoverContent>
            </Popover>

            {/* Avatar popover — icon-collapsed mode */}
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="
              hidden
              group-data-[collapsible=icon]:flex
              group-data-[collapsible=icon]:items-center
              group-data-[collapsible=icon]:justify-center
            "
                    >
                        <Avatar className="h-8 w-8 shrink-0">
                            {avatarSrc ? <AvatarImage src={avatarSrc} /> : null}
                            <AvatarFallback>
                                {username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </PopoverTrigger>

                <PopoverContent className="p-2 w-60" align="end" side="right">
                    <UserMenuContent
                        onSettings={onSettings}
                        onLogout={onLogout}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
