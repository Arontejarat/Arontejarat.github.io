type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[]

/** Minimal className joiner (no conflict resolution — components avoid conflicting utilities). */
export function cn(...values: ClassValue[]): string {
  const out: string[] = []
  for (const v of values) {
    if (!v || v === true) continue
    if (Array.isArray(v)) {
      const inner = cn(...v)
      if (inner) out.push(inner)
    } else out.push(String(v))
  }
  return out.join(' ')
}

let counter = 0
export function uid(prefix = 'id') {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
