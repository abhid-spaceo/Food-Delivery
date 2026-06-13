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
      // NOTE: ACCEPTED->CANCELLED is now graph-legal (admin-only); removed from
      // this list. Actor restriction is tested in the actor-authorization block.
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
    it("ACCEPTED can go to PREPARING or CANCELLED (admin-cancel edge)", () => {
      expect([...nextStatuses("ACCEPTED" as never)].sort()).toEqual(
        ["CANCELLED", "PREPARING"].sort(),
      );
    });
    it("PREPARING leads to READY or CANCELLED (admin-cancel edge)", () => {
      expect([...nextStatuses("PREPARING" as never)].sort()).toEqual(
        ["CANCELLED", "READY"].sort(),
      );
    });
    it("READY leads to OUT_FOR_DELIVERY or CANCELLED (admin-cancel edge)", () => {
      expect([...nextStatuses("READY" as never)].sort()).toEqual(
        ["CANCELLED", "OUT_FOR_DELIVERY"].sort(),
      );
    });
    it("OUT_FOR_DELIVERY leads to DELIVERED or CANCELLED (admin-cancel edge)", () => {
      expect([...nextStatuses("OUT_FOR_DELIVERY" as never)].sort()).toEqual(
        ["CANCELLED", "DELIVERED"].sort(),
      );
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
    it("customer CANNOT cancel after PLACED (actor-restricted edges)", () => {
      expect(() =>
        assertTransition("ACCEPTED" as never, "CANCELLED" as never, "CUSTOMER"),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition("PREPARING" as never, "CANCELLED" as never, "CUSTOMER"),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition("READY" as never, "CANCELLED" as never, "CUSTOMER"),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition("OUT_FOR_DELIVERY" as never, "CANCELLED" as never, "CUSTOMER"),
      ).toThrow(UnauthorizedActorError);
    });
    it("restaurant CANNOT force-cancel (actor-restricted edges)", () => {
      expect(() =>
        assertTransition("ACCEPTED" as never, "CANCELLED" as never, "RESTAURANT"),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition("PREPARING" as never, "CANCELLED" as never, "RESTAURANT"),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition("READY" as never, "CANCELLED" as never, "RESTAURANT"),
      ).toThrow(UnauthorizedActorError);
    });
    it("driver CANNOT force-cancel (actor-restricted edges)", () => {
      expect(() =>
        assertTransition("READY" as never, "CANCELLED" as never, "DRIVER"),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition("OUT_FOR_DELIVERY" as never, "CANCELLED" as never, "DRIVER"),
      ).toThrow(UnauthorizedActorError);
    });
    it("admin CAN force-cancel from any non-terminal status", () => {
      const nonTerminal = [
        "PLACED",
        "ACCEPTED",
        "PREPARING",
        "READY",
        "OUT_FOR_DELIVERY",
      ] as const;
      for (const from of nonTerminal) {
        expect(() =>
          assertTransition(from as never, "CANCELLED" as never, "ADMIN"),
        ).not.toThrow();
      }
    });
    it("admin CANNOT cancel an already-terminal order (graph illegal)", () => {
      for (const terminal of ["DELIVERED", "REJECTED", "CANCELLED"] as const) {
        expect(() =>
          assertTransition(terminal as never, "CANCELLED" as never, "ADMIN"),
        ).toThrow(IllegalTransitionError);
      }
    });
    it("admin is allowed on every legal edge (kitchen + delivery legs)", () => {
      const edges: ReadonlyArray<[string, string]> = [
        ["PLACED", "ACCEPTED"],
        ["PLACED", "REJECTED"],
        ["PLACED", "CANCELLED"],
        ["ACCEPTED", "PREPARING"],
        ["ACCEPTED", "CANCELLED"],
        ["PREPARING", "READY"],
        ["PREPARING", "CANCELLED"],
        ["READY", "OUT_FOR_DELIVERY"],
        ["READY", "CANCELLED"],
        ["OUT_FOR_DELIVERY", "DELIVERED"],
        ["OUT_FOR_DELIVERY", "CANCELLED"],
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
