import type { FilingStatus, SourceKind, Stage } from "@app/schema";
import type { Rng } from "./random";

// The 25 demo households. Every name, employer and address is invented.
// Each spec says what kind of household it is and which stage each of its returns is in this season.

export type Archetype =
  | "single_w2"
  | "student"
  | "mfj_w2"
  | "mfj_kids"
  | "mfj_kids_invest"
  | "hoh"
  | "ihss"
  | "ihss_parent"
  | "gig"
  | "landlord"
  | "retiree"
  | "mfs"
  | "family_teen";

// Scenario details the pipeline should be able to show.
export type Extra = "rejected_doc" | "question" | "partial_payment" | "failed_payment" | "changed_jobs";

export type HouseholdSpec = {
  archetype: Archetype;
  stages: Stage[]; // one per return, in the archetype's return order
  returning?: boolean; // has a complete prior-year return (drives the returning-client checklist)
  amended?: boolean; // prior-year return also has a 1040-X in progress (implies returning)
  delegate?: boolean; // an adult child manages the account through a household grant
  extra?: Extra;
};

export const HOUSEHOLDS: HouseholdSpec[] = [
  { archetype: "single_w2", stages: ["invited"] },
  { archetype: "student", stages: ["invited"] },
  { archetype: "mfj_w2", stages: ["invited"] },
  { archetype: "gig", stages: ["intake"] },
  { archetype: "hoh", stages: ["intake"], extra: "question" },
  { archetype: "ihss", stages: ["intake"] },
  { archetype: "mfj_kids", stages: ["documents"], returning: true, extra: "rejected_doc" },
  { archetype: "ihss_parent", stages: ["documents"] },
  { archetype: "mfj_kids_invest", stages: ["documents"], returning: true },
  { archetype: "retiree", stages: ["documents"], delegate: true },
  { archetype: "landlord", stages: ["ready"], returning: true },
  { archetype: "single_w2", stages: ["ready"] },
  { archetype: "retiree", stages: ["ready"] },
  { archetype: "family_teen", stages: ["preparing", "documents"] },
  { archetype: "mfs", stages: ["preparing", "review"] },
  { archetype: "gig", stages: ["preparing"], returning: true },
  { archetype: "mfj_w2", stages: ["review"], returning: true, extra: "changed_jobs" },
  { archetype: "hoh", stages: ["review"] },
  { archetype: "ihss", stages: ["filed"] },
  { archetype: "landlord", stages: ["filed"], extra: "partial_payment" },
  { archetype: "mfj_kids_invest", stages: ["filed"], extra: "failed_payment" },
  { archetype: "single_w2", stages: ["complete"], returning: true },
  { archetype: "student", stages: ["complete"] },
  { archetype: "retiree", stages: ["complete"] },
  { archetype: "mfj_w2", stages: ["intake"], returning: true, amended: true },
];

// ---- Plans: what an archetype turns into once names are drawn ----

export type PersonPlan = { key: string; first: string; last: string; dob: string; adult: boolean };
export type SourcePlan = {
  key: string;
  kind: SourceKind;
  label: string;
  owners: string[];
  firstYearOffset?: number; // relative to the current season's tax year
  lastYearOffset?: number;
};
export type ReturnPlan = {
  status: FilingStatus;
  primary: string;
  spouse?: string;
  dependents: { key: string; relationship: string; months: number }[];
  sources: string[];
  extraDocs: string[]; // document kinds not tied to a source (1098-T, childcare receipts)
};
export type HouseholdPlan = {
  displayName: string;
  people: PersonPlan[];
  sources: SourcePlan[];
  returns: ReturnPlan[];
};

const FIRST = [
  "Dana", "Alex", "Jordan", "Priya", "Marcus", "Elena", "Tomas", "Aisha", "Kenji", "Rosa", "Malik", "Hana",
  "Diego", "Nadia", "Owen", "Leilani", "Samir", "Grace", "Mateo", "Imani", "Felix", "Yuna", "Andre", "Sofia",
  "Theo", "Amara", "Luis", "Mei", "Caleb", "Zara", "Rafael", "Nora", "Isaac", "Lucia", "Emeka", "Ruby",
  "Hector", "Keiko", "Omar", "Talia", "Quinn", "Esme", "Victor", "Anya", "Bashir", "Celeste", "Dmitri", "Farah",
  "Gideon", "Ingrid", "Jonah", "Kalani", "Lena", "Moses", "Noelle", "Pablo", "Renata", "Silas", "Uma", "Wes",
  "Ximena", "Yusuf", "Zoe", "Arlo", "Beatriz", "Cyrus", "Delia", "Ezra", "Freya", "Gus",
];
const LAST = [
  "Reyes", "Lin", "Okafor", "Nguyen", "Castillo", "Haddad", "Patel", "Moreau", "Tanaka", "Alvarez", "Brennan",
  "Kowalski", "Mensah", "Ortiz", "Sato", "Delgado", "Farouk", "Lindqvist", "Mbeki", "Navarro", "Park", "Quintero",
  "Rahman", "Sokolov", "Torres", "Vasquez", "Whitfield", "Yamada", "Zhou", "Abara", "Bianchi", "Cordero",
  "Duarte", "Esposito", "Fonseca",
];
const EMPLOYERS = [
  "Acme Logistics", "Bluebird Dental Group", "Cedar Valley Unified", "Pinecrest Medical Center", "Sunset Grocery Co.",
  "Riverbend Credit Union", "Golden Poppy Warehousing", "Maple Street Cafe", "Coastline Solar", "Evergreen Home Health",
  "Summit Auto Repair", "Lakeside Community College", "Redwood Parcel Service", "Harborview Hotel", "Oak & Anchor Bakery",
];
const PART_TIME = ["Campus Bookstore", "Lakeside Community College", "Maple Street Cafe", "Sunset Grocery Co."];
const BUSINESSES = ["Rideshare driving", "Freelance graphic design", "Mobile dog grooming", "Home cleaning service"];
const STREETS = ["Elm St", "Juniper Ave", "Willow Ct", "Sycamore Dr", "Laurel Way"];

export function planHousehold(spec: HouseholdSpec, rng: Rng, pools: { first: string[]; last: string[] }): HouseholdPlan {
  const surname = rng.take(pools.last);
  const people: PersonPlan[] = [];
  const person = (key: string, age: [number, number], last = surname): string => {
    const born = 2026 - rng.int(age[0], age[1]);
    const dob = `${born}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
    people.push({ key, first: rng.take(pools.first), last, dob, adult: age[0] >= 18 });
    return key;
  };
  const spouseSurname = () => (rng.chance(0.4) ? rng.take(pools.last) : surname);
  const employer = (key: string, owner: string, labels = EMPLOYERS): SourcePlan => ({
    key,
    kind: "employer",
    label: rng.pick(labels),
    owners: [owner],
  });
  const kid = (key: string, age: [number, number]) => {
    person(key, age);
    return { key, relationship: rng.pick(["son", "daughter"]), months: 12 };
  };

  const sources: SourcePlan[] = [];
  const returns: ReturnPlan[] = [];
  let spouseLast: string | undefined;

  switch (spec.archetype) {
    case "single_w2": {
      const p = person("p", [24, 58]);
      sources.push(employer("e1", p));
      returns.push({ status: "single", primary: p, dependents: [], sources: ["e1"], extraDocs: [] });
      break;
    }
    case "student": {
      const p = person("p", [19, 22]);
      sources.push(employer("e1", p, PART_TIME));
      returns.push({ status: "single", primary: p, dependents: [], sources: ["e1"], extraDocs: ["1098_t"] });
      break;
    }
    case "mfj_w2":
    case "mfj_kids":
    case "mfj_kids_invest":
    case "landlord": {
      const p = person("p", [28, 60]);
      spouseLast = spouseSurname();
      const s = person("s", [28, 60], spouseLast);
      sources.push(employer("e1", p), employer("e2", s));
      const deps = spec.archetype === "mfj_kids" || spec.archetype === "mfj_kids_invest" ? [kid("k1", [4, 12]), kid("k2", [2, 10])] : [];
      const own = ["e1", "e2"];
      if (spec.archetype === "mfj_kids_invest") {
        sources.push(
          { key: "b1", kind: "brokerage", label: rng.pick(["Summit Brokerage", "Oakleaf Investing"]), owners: [p, s] },
          { key: "bank", kind: "bank", label: "Valley Community Bank", owners: [p, s] },
        );
        own.push("b1", "bank");
      }
      if (spec.archetype === "landlord") {
        sources.push({ key: "r1", kind: "rental_property", label: `${rng.int(100, 999)} ${rng.pick(STREETS)} duplex`, owners: [p, s] });
        own.push("r1");
      }
      if (spec.extra === "changed_jobs") {
        // Left the old job last year; the checklist should stop asking for its W-2.
        sources[0] = { ...sources[0]!, lastYearOffset: -1 };
        sources.push({ ...employer("e3", p), firstYearOffset: 0 });
        own.push("e3"); // each year's return only picks up the sources active that year
      }
      returns.push({ status: "mfj", primary: p, spouse: s, dependents: deps, sources: own, extraDocs: deps.length ? ["childcare_receipt"] : [] });
      break;
    }
    case "hoh": {
      const p = person("p", [26, 50]);
      const k = kid("k1", [3, 11]);
      sources.push(employer("e1", p));
      returns.push({ status: "hoh", primary: p, dependents: [k], sources: ["e1"], extraDocs: ["childcare_receipt"] });
      break;
    }
    case "ihss":
    case "ihss_parent": {
      const p = person("p", [30, 62]);
      sources.push({ key: "i1", kind: "ihss_provider", label: "IHSS provider · Demo County", owners: [p] });
      const deps = spec.archetype === "ihss_parent" ? [kid("k1", [6, 15])] : [];
      returns.push({ status: deps.length ? "hoh" : "single", primary: p, dependents: deps, sources: ["i1"], extraDocs: [] });
      break;
    }
    case "gig": {
      const p = person("p", [23, 45]);
      sources.push({ key: "biz", kind: "business", label: rng.pick(BUSINESSES), owners: [p] });
      returns.push({ status: "single", primary: p, dependents: [], sources: ["biz"], extraDocs: [] });
      break;
    }
    case "retiree": {
      const p = person("p", [66, 82]);
      sources.push(
        { key: "ret", kind: "retirement", label: "Demo County Pension Plan", owners: [p] },
        { key: "bank", kind: "bank", label: "Valley Community Bank", owners: [p] },
      );
      returns.push({ status: "single", primary: p, dependents: [], sources: ["ret", "bank"], extraDocs: [] });
      break;
    }
    case "mfs": {
      const p = person("p", [30, 55]);
      spouseLast = spouseSurname();
      const s = person("s", [30, 55], spouseLast);
      sources.push(employer("e1", p), employer("e2", s));
      returns.push(
        { status: "mfs", primary: p, dependents: [], sources: ["e1"], extraDocs: [] },
        { status: "mfs", primary: s, dependents: [], sources: ["e2"], extraDocs: [] },
      );
      break;
    }
    case "family_teen": {
      const p = person("p", [40, 55]);
      spouseLast = spouseSurname();
      const s = person("s", [40, 55], spouseLast);
      person("t", [18, 18]);
      const teen = { key: "t", relationship: rng.pick(["son", "daughter"]), months: 12 };
      const k = kid("k1", [8, 14]);
      sources.push(employer("e1", p), employer("e2", s), employer("et", "t", PART_TIME));
      returns.push(
        { status: "mfj", primary: p, spouse: s, dependents: [teen, k], sources: ["e1", "e2"], extraDocs: [] },
        // Claimed on the parents' return and filing their own: rules R6–R8 allow both.
        { status: "single", primary: "t", dependents: [], sources: ["et"], extraDocs: [] },
      );
      break;
    }
  }

  const displayName = spouseLast && spouseLast !== surname ? `${surname}-${spouseLast}` : surname;
  return { displayName, people, sources, returns };
}

export const namePools = () => ({ first: [...FIRST], last: [...LAST] });
