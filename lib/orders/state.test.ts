import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
  nextStatuses,
} from "./state";

describe("order state machine", () => {
  describe("legal transitions", () => {
    const legal: ReadonlyArray<[string, string]> = [
      ["PLACED", "ACCEPTED"],
      ["PLACED", "REJECTED"],
      ["PLACED", "CANCELLED"],
      ["ACCEPTED", "PREPARING"],
      ["PREPARING", "OUT_FOR_DELIVERY"],
      ["OUT_FOR_DELIVERY", "DELIVERED"],
    ];
    it.each(legal)("allows %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(true);
      expect(() => assertTransition(from as never, to as never)).not.toThrow();
    });
  });

  describe("illegal transitions", () => {
    const illegal: ReadonlyArray<[string, string]> = [
      ["PLACED", "DELIVERED"], // the canonical illegal jump
      ["PLACED", "PREPARING"],
      ["ACCEPTED", "DELIVERED"],
      ["ACCEPTED", "CANCELLED"], // cancel only allowed before acceptance
      ["PREPARING", "ACCEPTED"], // no going backwards
      ["DELIVERED", "PLACED"],
      ["REJECTED", "ACCEPTED"],
      ["CANCELLED", "PLACED"],
      ["OUT_FOR_DELIVERY", "PREPARING"],
    ];
    it.each(illegal)("blocks %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(false);
      expect(() => assertTransition(from as never, to as never)).toThrow(
        IllegalTransitionError,
      );
    });
  });

  describe("isTerminal", () => {
    it.each(["DELIVERED", "REJECTED", "CANCELLED"])(
      "%s is terminal",
      (s) => expect(isTerminal(s as never)).toBe(true),
    );
    it.each(["PLACED", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"])(
      "%s is not terminal",
      (s) => expect(isTerminal(s as never)).toBe(false),
    );
  });

  describe("nextStatuses", () => {
    it("returns the three branch options from PLACED", () => {
      expect([...nextStatuses("PLACED" as never)].sort()).toEqual(
        ["ACCEPTED", "CANCELLED", "REJECTED"].sort(),
      );
    });
    it("returns empty for a terminal state", () => {
      expect(nextStatuses("DELIVERED" as never)).toHaveLength(0);
    });
  });
});
