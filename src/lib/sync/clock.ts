/**
 * Monotone Zeitstempel in Millisekunden. `next()` ist nie kleiner als ein bereits gesehener Stempel,
 * damit eine nachgehende Geraeteuhr fremde, neuere Aenderungen nicht ueberschreibt.
 */
export class Clock {
  private last = 0
  constructor(private readonly now: () => number = Date.now) {}

  next(): number {
    this.last = Math.max(this.now(), this.last + 1)
    return this.last
  }

  /** Fremden Stempel zur Kenntnis nehmen. */
  observe(t: number): void {
    if (t > this.last) this.last = t
  }
}
