// "Join the list" on the splash page (ticket 53) writes to the practice: the visitor's mail app opens with the note
// already written. Nothing is stored or sent by the site (no form posts anywhere until self sign-up exists).

export function joinHref(to: string, email: string, reminders: boolean, brand = "belltax.") {
  const body = [`Please add ${email} to the ${brand} list for when booking opens.`, ...(reminders ? ["Also remind me about tax deadlines."] : [])].join("\n\n");
  return `mailto:${to}?subject=${encodeURIComponent("Add me to the list")}&body=${encodeURIComponent(body)}`;
}
