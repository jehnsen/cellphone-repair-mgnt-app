/**
 * Deterministic randomness. The seed data must be identical on every reload
 * so screenshots, tests, and "the ticket I was just looking at" all survive
 * a refresh. Never call Math.random() in the mock layer.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;

  constructor(seed = 20260825) {
    this.next = mulberry32(seed);
  }

  float(min = 0, max = 1): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }

  /** Pick `n` distinct items, or fewer if the pool is short. */
  sample<T>(items: readonly T[], n: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(this.int(0, pool.length - 1), 1)[0]!);
    }
    return out;
  }

  /** Weighted pick: [["a", 3], ["b", 1]] picks "a" three times as often. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.float(0, total);
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** Money with a shop-realistic ending: 1,250 / 1,299 / 850. */
  price(min: number, max: number, step = 50): number {
    const raw = this.float(min, max);
    return Math.max(step, Math.round(raw / step) * step);
  }

  digits(length: number): string {
    let out = "";
    for (let i = 0; i < length; i += 1) out += this.int(0, 9).toString();
    return out;
  }

  /** Claim/warranty codes skip I, O, 0, 1 — they get misread over the phone. */
  code(length = 6): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[this.int(0, alphabet.length - 1)];
    }
    return out;
  }
}
