import { describe, expect, it } from "vitest";
import { assertClaimed, AlreadyClaimedError } from "./claim";

describe("atomic claim contract", () => {
  it("treats an updateMany count of 1 as a successful claim (no throw)", () => {
    expect(() => assertClaimed(1)).not.toThrow();
  });

  it("treats 0 rows as already-claimed and throws AlreadyClaimedError", () => {
    expect(() => assertClaimed(0)).toThrow(AlreadyClaimedError);
  });

  it("any non-positive count is already-claimed", () => {
    expect(() => assertClaimed(-1)).toThrow(AlreadyClaimedError);
  });
});
