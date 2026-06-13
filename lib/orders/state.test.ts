import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canActorTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
  nextStatuses,
  UnauthorizedActorError,
} from "./state";

describe("order state machine", () => {
  describe("legal transitions", () => {
    const legal: ReadonlyArray<[string, string]> = [
      ["PLACED", "ACCEPTED"],
      ["PLACED", "REJECTED"],
      ["PLACED", "CANCELLED"],
      ["ACCEPTED", "PREPARING"],
      ["PREPARING", "READY"],
      ["READY", "OUT_FOR_DELIVERY"],
      ["OUT_FOR_DELIVERY", "DELIVERED"],
    ];
    it.each(legal)("allows %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(true);
      expect(() => assertTransition(from as never, to as never)).not.toThrow();
    });
  });

  describe("illegal transitions", () => {
    const illegal: ReadonlyArray<[string, string]> = [
      ["PLACED", "DELIVERED"],
      ["PLACED", "PREPARING"],
      ["ACCEPTED", "DELIVERED"],
      ["ACCEPTED", "READY"],
      ["ACCEPTED", "CANCELLED"],
      ["PREPARING", "OUT_FOR_DELIVERY"],
      ["PREPARING", "ACCEPTED"],
      ["READY", "DELIVERED"],
      ["READY", "PREPARING"],
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
    it.each(["DELIVERED", "REJECTED", "CANCELLED"])("%s is terminal", (s) =>
      expect(isTerminal(s as never)).toBe(true),
    );
    it.each(["PLACED", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"])(
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
    it("PREPARING leads only to READY", () => {
      expect(nextStatuses("PREPARING" as never)).toEqual(["READY"]);
    });
    it("READY leads only to OUT_FOR_DELIVERY", () => {
      expect(nextStatuses("READY" as never)).toEqual(["OUT_FOR_DELIVERY"]);
    });
    it("returns empty for a terminal state", () => {
      expect(nextStatuses("DELIVERED" as never)).toHaveLength(0);
    });
  });

  describe("actor authorization", () => {
    it("restaurant may drive the kitchen legs through READY", () => {
      expect(
        canActorTransition("PREPARING" as never, "READY" as never, "RESTAURANT"),
      ).toBe(true);
      expect(() =>
        assertTransition("PREPARING" as never, "READY" as never, "RESTAURANT"),
      ).not.toThrow();
    });
    it("restaurant may NOT perform the delivery legs", () => {
      expect(
        canActorTransition(
          "READY" as never,
          "OUT_FOR_DELIVERY" as never,
          "RESTAURANT",
        ),
      ).toBe(false);
      expect(() =>
        assertTransition(
          "READY" as never,
          "OUT_FOR_DELIVERY" as never,
          "RESTAURANT",
        ),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition(
          "OUT_FOR_DELIVERY" as never,
          "DELIVERED" as never,
          "RESTAURANT",
        ),
      ).toThrow(UnauthorizedActorError);
    });
    it("driver may perform the delivery legs but not the kitchen legs", () => {
      expect(() =>
        assertTransition("READY" as never, "OUT_FOR_DELIVERY" as never, "DRIVER"),
      ).not.toThrow();
      expect(() =>
        assertTransition(
          "OUT_FOR_DELIVERY" as never,
          "DELIVERED" as never,
          "DRIVER",
        ),
      ).not.toThrow();
      expect(() =>
        assertTransition("PREPARING" as never, "READY" as never, "DRIVER"),
      ).toThrow(UnauthorizedActorError);
    });
    it("customer may only cancel a not-yet-accepted order", () => {
      expect(() =>
        assertTransition("PLACED" as never, "CANCELLED" as never, "CUSTOMER"),
      ).not.toThrow();
      expect(() =>
        assertTransition("PLACED" as never, "ACCEPTED" as never, "CUSTOMER"),
      ).toThrow(UnauthorizedActorError);
    });
    it("admin is allowed on every legal edge", () => {
      const edges: ReadonlyArray<[string, string]> = [
        ["PLACED", "ACCEPTED"],
        ["PLACED", "REJECTED"],
        ["PLACED", "CANCELLED"],
        ["ACCEPTED", "PREPARING"],
        ["PREPARING", "READY"],
        ["READY", "OUT_FOR_DELIVERY"],
        ["OUT_FOR_DELIVERY", "DELIVERED"],
      ];
      for (const [from, to] of edges) {
        expect(() =>
          assertTransition(from as never, to as never, "ADMIN"),
        ).not.toThrow();
      }
    });
    it("graph illegality beats actor: even admin cannot make an illegal jump", () => {
      expect(() =>
        assertTransition("PLACED" as never, "DELIVERED" as never, "ADMIN"),
      ).toThrow(IllegalTransitionError);
    });
  });
});
