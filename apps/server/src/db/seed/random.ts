// Deterministic randomness for the demo seed: same seed in, same data out.

export type Rng = ReturnType<typeof createRng>;

export function createRng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)]!;
  const chance = (p: number) => next() < p;
  // Draw without replacement so households never share a name.
  const take = <T>(pool: T[]): T => pool.splice(int(0, pool.length - 1), 1)[0]!;
  const hex = (digits: number) => Array.from({ length: digits }, () => int(0, 15).toString(16)).join("");

  // UUIDv7-shaped ids from a fixed epoch plus a counter: valid, ordered, and identical on every
  // reseed, so demo links survive reboots.
  const ID_EPOCH_MS = Date.UTC(2026, 0, 1);
  let counter = 0;
  const id = () => {
    const ms = (ID_EPOCH_MS + counter++).toString(16).padStart(12, "0");
    const variant = (8 + int(0, 3)).toString(16);
    return `${ms.slice(0, 8)}-${ms.slice(8, 12)}-7${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
  };

  return { next, int, pick, chance, take, id };
}
