import type { Message } from "./email";

// The practice's messages (ticket 51). Plain words, one button, the brand's colours. No client data beyond a first
// name and the practice's own details: never an amount, a document, a return or anything from intake.

type Practice = { practiceName: string; preparerName: string };
const first = (name: string) => name.split(/\s+/)[0] ?? name;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// One layout for every message: inline styles only (mail clients ignore stylesheets), light background, charcoal and
// chartreuse, a text fallback that says the same thing.
function layout(p: Practice, heading: string, paragraphs: string[], button?: { label: string; url: string }, footnote?: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#262626">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e3e3df;border-radius:16px;padding:32px">
<tr><td style="font-size:22px;font-weight:800;letter-spacing:-0.5px;padding-bottom:24px">belltax<span style="color:#7b9b00">.</span></td></tr>
<tr><td style="font-size:22px;font-weight:700;line-height:1.25;padding-bottom:12px">${esc(heading)}</td></tr>
${paragraphs.map((t) => `<tr><td style="font-size:16px;line-height:1.55;color:#454545;padding-bottom:12px">${esc(t)}</td></tr>`).join("")}
${button ? `<tr><td style="padding:12px 0 20px"><a href="${esc(button.url)}" style="display:inline-block;background:#d4f25a;color:#262626;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:999px">${esc(button.label)}</a></td></tr>` : ""}
${footnote ? `<tr><td style="font-size:13px;line-height:1.5;color:#7a7a7a;border-top:1px solid #eeeeea;padding-top:16px">${esc(footnote)}</td></tr>` : ""}
</table>
<p style="font-size:12px;color:#9a9a9a;margin:16px 0 0">${esc(p.practiceName)} · sent by ${esc(p.preparerName)}</p>
</td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(button ? ["", `${button.label}: ${button.url}`] : []), ...(footnote ? ["", footnote] : []), "", `${p.practiceName} · sent by ${p.preparerName}`].join("\n");
  return { html, text };
}

export function inviteEmail(to: string, firstName: string | null, p: Practice, url: string, days: number): Message {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  const { html, text } = layout(
    p,
    `${first(p.preparerName)} invited you to ${p.practiceName}`,
    [hi, `Your tax agent set up a secure place for this year's return: answer a few questions, send your documents and see where things stand, all from your phone.`],
    { label: "Set up my account", url },
    `This link works once and expires in ${days} days. If you weren't expecting it, you can ignore this email.`,
  );
  return { to, subject: `Set up your ${p.practiceName} account`, text, html, template: "invite" };
}

export function resetEmail(to: string, firstName: string | null, p: Practice, url: string, hours: number): Message {
  const { html, text } = layout(
    p,
    "Set up your sign-in again",
    [
      firstName ? `Hi ${firstName},` : "Hi,",
      "Use this link to set up a new passkey on the phone or computer you have now. Your old passkeys stop working, and you'll be signed out everywhere else.",
    ],
    { label: "Set up my sign-in", url },
    `This link works once and expires in ${hours} hours. If you didn't ask for it, ignore this email: nothing changes until the link is used.`,
  );
  return { to, subject: `Set up your ${p.practiceName} sign-in again`, text, html, template: "reset" };
}

export function signInChangedEmail(to: string, firstName: string | null, p: Practice, what: string): Message {
  const { html, text } = layout(
    p,
    "Your sign-in changed",
    [firstName ? `Hi ${firstName},` : "Hi,", `${what} on your ${p.practiceName} account just now.`, `If that was you, there's nothing to do. If it wasn't, reply to this email or call ${first(p.preparerName)} straight away.`],
  );
  return { to, subject: `Your ${p.practiceName} sign-in changed`, text, html, template: "sign-in-changed" };
}
