const UNIT = 1024 // 10 bits for the device number; 1.7e12 ms * 1024 stays below Number.MAX_SAFE_INTEGER
/** A timestamp more than this far ahead of the local clock is treated as corrupt or malicious. */
export const MAX_AHEAD_MS = 24 * 60 * 60 * 1000

/**
 * Strictly monotonic timestamps, unique per device: `milliseconds * 1024 + deviceNumber`.
 * Two devices therefore never issue the same timestamp (found by the fault-injection test: equal timestamps
 * made devices keep different values for the same entry forever). A device behind in time never overtakes
 * newer foreign changes, because `observe()` raises the floor.
 * Older data written as plain milliseconds is smaller than anything issued now, so new changes win over it.
 *
 * Timestamp poisoning: any party member could write t = 2^53-1; since the newest timestamp wins, that entry could
 * never change again and every device's clock would jump into the unsafe-integer range. `isPlausible()` rejects
 * such values and `observe()` ignores them.
 */
export class Clock {
  private last = 0
  private readonly node: number

  constructor(private readonly now: () => number = Date.now, node = 0) {
    this.node = ((Math.floor(node) % UNIT) + UNIT) % UNIT
  }

  next(): number {
    let t = this.now() * UNIT + this.node
    if (t <= this.last) t = (Math.floor(this.last / UNIT) + 1) * UNIT + this.node
    this.last = t
    return t
  }

  /** Is this a believable timestamp (a safe integer, positive, not absurdly far in the future)? */
  isPlausible(t: number): boolean {
    return Number.isSafeInteger(t) && t > 0 && t <= (this.now() + MAX_AHEAD_MS) * UNIT + UNIT
  }

  /** Take note of a foreign timestamp; implausible ones are ignored. */
  observe(t: number): void {
    if (this.isPlausible(t) && t > this.last) this.last = t
  }
}
