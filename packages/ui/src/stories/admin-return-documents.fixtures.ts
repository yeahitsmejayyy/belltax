import type { RequestDocumentKind, RequestPerson } from "../components/request-document-sheet";
import type { ReturnDocument, ReturnWaitingRequest } from "../components/return-documents";
import type { ReturnLetterData } from "../components/return-letter";

// Invented data for the admin return page's Documents and Letter stories (ticket 59). Nothing here is real: the
// practice is Bell Tax, its preparer Morgan Hale, the household and its people are invented, IPs are documentation
// addresses (RFC 5737). The "files" are drawn here as data: URIs, so the viewer has something to show.

export const PRACTICE = "Bell Tax";
export const PREPARER = "Morgan Hale";
export const FILERS = "Dana & Sam Marigold";

// A paper-coloured page with a few grey lines: stands in for a scanned W-2.
const page = `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100"><rect width="850" height="1100" fill="#fbfaf6"/><text x="60" y="110" font-family="sans-serif" font-size="40" fill="#333">W-2 · Sample, invented</text><text x="60" y="160" font-family="sans-serif" font-size="22" fill="#777">Harbor Freight Logistics (invented) · Dana Marigold · SSN ***-**-9041</text>${Array.from({ length: 14 }, (_, i) => `<rect x="60" y="${230 + i * 56}" width="${i % 3 ? 730 : 420}" height="18" rx="4" fill="#e3e1da"/>`).join("")}</svg>`;
export const SAMPLE_IMAGE_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(page)}`;

// A one-page PDF saying it's a sample.
const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 74>>stream
BT /F1 24 Tf 72 700 Td (1099-INT sample, invented for Storybook) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
export const SAMPLE_PDF_SRC = `data:application/pdf;base64,${btoa(pdf)}`;

export const PEOPLE: RequestPerson[] = [
  { personId: "p-dana", firstName: "Dana", lastName: "Marigold" },
  { personId: "p-sam", firstName: "Sam", lastName: "Marigold" },
  { personId: "p-rowan", firstName: "Rowan", lastName: "Marigold" },
];

const base = { mimeType: "application/pdf", sizeBytes: 412_000, deletedAt: null, rejectReason: null, identity: false, request: null } as const;

export const W2: ReturnDocument = {
  ...base,
  id: "doc-w2",
  kindLabel: "W-2",
  status: "uploaded",
  filename: "w2-harbor-freight.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 1_830_000,
  uploadedAt: "2026-02-14T18:20:00.000Z",
  who: "Dana",
  request: "W-2 from Harbor Freight Logistics",
};

export const INTEREST: ReturnDocument = {
  ...base,
  id: "doc-1099int",
  kindLabel: "1099-INT",
  status: "accepted",
  filename: "1099-int-tidewater-credit-union.pdf",
  uploadedAt: "2026-02-10T16:05:00.000Z",
  who: "Household",
};

export const DAYCARE: ReturnDocument = {
  ...base,
  id: "doc-daycare",
  kindLabel: "Childcare receipts",
  status: "rejected",
  filename: "daycare-receipts.pdf",
  sizeBytes: 96_000,
  uploadedAt: "2026-02-12T21:40:00.000Z",
  rejectReason: "Page 2 is cut off at the bottom. Please retake the photo with the whole page showing.",
  who: "Sam",
};

/** A photo ID waiting for review: accepting it verifies it and deletes the image. */
export const PHOTO_ID: ReturnDocument = {
  ...base,
  id: "doc-id-sam",
  kindLabel: "Photo ID",
  status: "uploaded",
  filename: "sam-drivers-license.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 640_000,
  uploadedAt: "2026-02-15T17:12:00.000Z",
  identity: true,
  who: "Sam",
};

/** A photo ID already verified (ticket 49): the image is gone, a note stays. */
export const VERIFIED_ID: ReturnDocument = {
  ...base,
  id: "doc-id-dana",
  kindLabel: "Photo ID",
  status: "accepted",
  filename: "dana-passport.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 720_000,
  uploadedAt: "2026-02-09T15:30:00.000Z",
  deletedAt: "2026-02-09T19:02:00.000Z",
  identity: true,
  who: "Dana",
};

/** A HEIC photo: browsers can't show it, so the viewer links to it. */
export const HEIC: ReturnDocument = {
  ...base,
  id: "doc-heic",
  kindLabel: "1098 Mortgage interest",
  status: "uploaded",
  filename: "IMG_4021.HEIC",
  mimeType: "image/heic",
  sizeBytes: 2_400_000,
  uploadedAt: "2026-02-16T02:11:00.000Z",
  who: "Household",
};

export const DOCUMENTS: ReturnDocument[] = [W2, PHOTO_ID, INTEREST, DAYCARE, VERIFIED_ID];

export const WAITING: ReturnWaitingRequest[] = [
  { id: "req-1098t", title: "1098-T Tuition statement", who: "Rowan", createdAt: "2026-02-08T17:00:00.000Z", note: "From Coastline Community College (invented)." },
  { id: "req-property", title: "Property tax bill", who: "Household", createdAt: "2026-02-08T17:01:00.000Z", note: null },
];

export const KINDS: RequestDocumentKind[] = [
  { code: "w2", label: "W-2", category: "income" },
  { code: "1099_int", label: "1099-INT Interest", category: "income" },
  { code: "1099_nec", label: "1099-NEC Contract work", category: "income" },
  { code: "1098", label: "1098 Mortgage interest", category: "deduction" },
  { code: "property_tax", label: "Property tax bill", category: "deduction" },
  { code: "1098_t", label: "1098-T Tuition statement", category: "credit" },
  { code: "childcare", label: "Childcare receipts", category: "credit" },
  { code: "photo_id", label: "Photo ID", category: "identity" },
  { code: "prior_return", label: "Last year's return", category: "prior_year" },
];

const LETTER_BODY = `Engagement letter for the Marigold household, tax year 2025

${PRACTICE} will prepare your 2025 federal and California returns from the information you give us. ${PREPARER} is your tax agent.

1. What we'll do
Prepare the returns, go through them with you, and file them electronically once you approve.

2. What you'll do
Answer the questions in the portal and upload the documents we ask for.

3. Fees
The fee is on your invoice. It's due when your return is ready for review.`;

const signers = [
  { personId: "p-dana", name: "Dana Marigold" },
  { personId: "p-sam", name: "Sam Marigold" },
];

export const DRAFT_LETTER: ReturnLetterData = { status: "draft", sentAt: null, body: LETTER_BODY, templateVersion: 3, signers, audit: null };

export const SENT_LETTER: ReturnLetterData = {
  ...DRAFT_LETTER,
  status: "sent",
  sentAt: "2026-02-02T17:00:00.000Z",
  audit: [{ personId: "p-dana", typedName: "Dana R. Marigold", signedAt: "2026-02-03T02:14:00.000Z", ip: "192.0.2.41", hashMatches: true }],
};

export const SIGNED_LETTER: ReturnLetterData = {
  ...SENT_LETTER,
  status: "signed",
  audit: [
    { personId: "p-dana", typedName: "Dana R. Marigold", signedAt: "2026-02-03T02:14:00.000Z", ip: "192.0.2.41", hashMatches: true },
    { personId: "p-sam", typedName: "Sam Marigold", signedAt: "2026-02-04T16:48:00.000Z", ip: "198.51.100.7", hashMatches: true },
  ],
};

/** A signature over text that's since changed: the tab warns and the row is flagged. */
export const MISMATCHED_LETTER: ReturnLetterData = {
  ...SIGNED_LETTER,
  audit: [
    { personId: "p-dana", typedName: "Dana R. Marigold", signedAt: "2026-02-03T02:14:00.000Z", ip: "192.0.2.41", hashMatches: true },
    { personId: "p-sam", typedName: "Sam Marigold", signedAt: "2026-02-04T16:48:00.000Z", ip: "198.51.100.7", hashMatches: false },
  ],
};

export const VOID_LETTER: ReturnLetterData = { ...SENT_LETTER, status: "void" };
