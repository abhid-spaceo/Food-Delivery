// Contract of the first-come atomic claim. The claim is a conditional updateMany
// (where status=READY AND driverId=null); the DB reports how many rows it changed.
// 1 => this driver won the order. 0 => someone else already claimed it (or it is
// no longer READY) — throw, and write NO status event. (CLAUDE.md atomic claim.)
export class AlreadyClaimedError extends Error {
  constructor() {
    super("This order was already claimed by another driver.");
    this.name = "AlreadyClaimedError";
  }
}

/** Throw AlreadyClaimedError unless the conditional update changed exactly the row. */
export function assertClaimed(updatedCount: number): void {
  if (updatedCount < 1) throw new AlreadyClaimedError();
}
