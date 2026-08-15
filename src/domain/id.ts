let counter = 0;

/** Stable, collision-resistant id generator for domain objects. */
export function uid(prefix = "obj"): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 999999);
}
