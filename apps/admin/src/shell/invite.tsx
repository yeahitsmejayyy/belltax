import * as React from "react";

// Any page can open Invite client (e.g. the empty pipeline's "Invite your first client"); the shell owns the dialog.
type Mode = "invite" | "add";
export const InviteContext = React.createContext<(mode?: Mode) => void>(() => {});
export const useInvite = () => React.useContext(InviteContext);
