# Bell Tax interface principles

Thirteen rules for every screen in the portal, the admin and the site. Each has a number, so a design review can
say "this breaks 5" instead of "this feels off". The values live in `packages/ui/src/tokens.css`. This page
says why they are what they are. It becomes the first page in Storybook (ticket 11).

The people using this are doing their taxes, often on a phone, often worried. The interface's job is to be calm,
obvious and hard to get wrong.

## 1. One primary action per screen

Exactly one filled primary button per screen (charcoal in light mode, chartreuse in dark): the thing this screen is for (Upload, Sign, Pay, Invite
client). Everything else is outline, ghost or a link. If two actions both seem primary, the screen is doing
two jobs. Split it.

## 2. A 4px spacing grid

Every gap, padding and margin is a multiple of 4px (Tailwind's `--spacing: 0.25rem`). The common steps are
**4 · 8 · 12 · 16 · 24 · 32 · 48**, with 2, 6 and 10 allowed inside dense components (chips, table cells).
Page gutters are 16px on phones, 24px on tablets and 32px on desktop. Related things sit closer together than
unrelated things. That's the whole layout system.

## 3. Type scale: Space Grotesk and Bricolage Grotesque, six sizes

Space Grotesk for body and UI, Bricolage Grotesque for headings (700–800, tracking −0.04em), and Geist Mono for
numbers that get read aloud (invoice numbers, amounts in tables, codes). All self-hosted. The security policy
only allows fonts from our own origin.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Caption, table meta | 12 / 16 | 500 |
| Dense UI (admin tables, chips) | 13 / 18 | 500 |
| Body, controls | 14 / 20 (desktop) · **16 / 24 (phones)** | 400, labels 500 |
| Section title | 16–17 / 24 | 600 |
| Page title | 20–24 / 28–32 | 600, tracking −0.025em |
| Display (portal hero numbers, marketing) | 26–44 | 600–700, tracking −0.025em |

Body weights: 400, 500, 700. The brand is **belltax.**: lowercase, Bricolage Grotesque 800, tracking −0.06em, and the
period is the accent (deep chartreuse on light, chartreuse on dark). The mark is **b.** on a rounded square (radius
25%). Both are outlined paths (`packages/ui/src/brand`), never live text. Tagline: *Taxes Made Easy*.

## 4. Phones: 44px targets, 16px text

Anything tappable is at least **44 × 44px** (`--touch-target`), even when it looks smaller. Pad the hit area,
not the icon. Body and form text is **16px** on phones, which is readable and stops iOS zooming into inputs.
Controls on phones are 44–48px tall.

## 5. Contrast: 4.5 : 1 for text, 3 : 1 for everything else

Body text, including placeholder text we rely on and the text inside chips, meets **4.5:1** against what it sits
on, in both themes. Large text (24px+, or 19px+ at 600), icons, focus rings and the edges of controls meet
**3:1**. `packages/ui/src/tokens.test.ts` checks every token pair; see "Open questions" for the one the design
doesn't meet yet.

## 6. Status is never colour alone

A stage or status always has an icon **and** a word, and colour only reinforces them. Four tones cover the
pipeline, and each maps to who's waiting:

| Tone | Means | Stages |
| --- | --- | --- |
| Outline (neutral) | waiting on the client | Invited, Intake, Documents, Client review |
| Brand | waiting on the preparer | Ready to prep, Preparing |
| Info | waiting on the IRS / FTB | Filed |
| Success | done | Complete |

The same pill geometry is used for document, invoice and payment status (`StagePill`, `StatusChip` in
`packages/ui`).

## 7. Motion: 150–300ms, eased, never bouncy

| Token | Value | For |
| --- | --- | --- |
| `--motion-fast` | 150ms | hovers, toggles, popovers |
| `--motion-base` | 200ms | dialogs, page entrance, toasts |
| `--motion-slow` | 300ms | sheets, the sidebar collapsing |
| `--motion-ease-standard` | cubic-bezier(0.4, 0, 0.2, 1) | things moving within the page |
| `--motion-ease-enter` | cubic-bezier(0, 0, 0.2, 1) | things arriving |
| `--motion-ease-emphasized` | cubic-bezier(0.2, 0, 0, 1) | pages and sheets settling |

No spring, no overshoot, nothing that loops except a loader (the b. mark pulses at 1.4s). With reduced motion
turned on, everything finishes instantly (tokens.css enforces it).

## 8. Radius: 12px base

`--radius: 0.75rem`. Steps: **8** (inputs, small buttons), **10** (buttons, menus), **12** (cards, dialogs),
**16** (sheets, large panels), and **full** for pills, avatars and toggles. Nested corners get smaller as they
go in, so they sit concentric.

## 9. Text wraps well

Headings use `text-wrap: balance`. Body copy uses `text-wrap: pretty`, so there are no single-word last lines.
Measure is 45–75 characters. Numbers in tables and money use tabular figures, so columns line up.

## 10. Validate like a person would

A field checks itself when you **leave** it. Once it has shown an error, it re-checks **as you type**, so the
error clears the moment it's fixed. Everything checks again on **submit**. Errors sit directly under the field
with an icon and a sentence saying what to do ("Enter the 4 digits"), never just "Invalid".

## 11. Every action says it worked

A completed action shows a toast, **top center**, that slides in and fades after about 4 seconds, saying what
happened ("Letter sent to Dana"). Anything that changes a client's record asks first in a dialog. Moving a
return backward always asks why (the reason is logged).

## 12. Demo is always labelled

The admin shows a Demo / Live badge at all times, and demo data is invented and looks it. SSNs only ever show
as the last four digits, and bank numbers never show in full, in both worlds. See
[docs/two-data-worlds.md](docs/two-data-worlds.md).

## 13. Dialogs sit on the upper third

A dialog that isn't full screen sits slightly above centre, on the rule of thirds: the point a third of the way
down the dialog lines up with a third of the way down the screen (`top: 33%`, `translateY(-33%)`). It feels
placed rather than dropped, and a tall dialog still never runs off the top. Sheets keep to their edge.
Aligned things share an axis too: in the collapsed sidebar, every icon is centred under the b. mark.

---

## Storybook is the reference

Every component the portal, the admin and the site use lives in `packages/ui` and has stories. The stories
are the exact reference for production: if a screen needs something a story doesn't show, the component
and its story change first, then the screen. Each story sits dead centre in its canvas, and wide ones (tables,
boards) fill a centred column. A story is still: its interaction test lives in a hidden twin
(`<Name> · test`, tagged `!dev`), which CI and the sidebar's "Run tests" button run, so opening a story never
plays an animation you didn't ask for.

## Open questions from the contrast check

These come from the design handoff's own tokens. They're in `tokens.css` exactly as designed and listed here for a
decision. `tokens.test.ts` holds them at their current values, so they can't get worse unnoticed.

1. **Resolved by the belltax. palette (October 2026).** White on the old #3B82F6 was 3.60 : 1. The new primary is
   charcoal with white text in light mode (16.3 : 1) and chartreuse with charcoal text in dark mode (13.3 : 1);
   the deep-chartreuse focus ring is 5.1 : 1 on the page.
2. **The warning icon on cards: 2.55 : 1 (needs 3).** The amber `--warning` in light mode, used for the health
   check triangles. Options: draw warning icons with `--warning-foreground` (7.37 : 1 on a card), or darken `--warning` to about `oklch(0.64 0.15 65)` (3.49 : 1). Dark mode passes as is.

Everything else passes. The status chips' text on their fills measures 5.9 to 9.5, and muted text 4.6 to 6.0.
