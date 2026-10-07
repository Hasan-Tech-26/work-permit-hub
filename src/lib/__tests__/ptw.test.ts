import { describe, expect, it } from "vitest";

const transitions: Record<string, string[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  ACTIVE: ["SUSPENDED", "CLOSED", "CANCELLED", "EXPIRED"],
  SUSPENDED: ["ACTIVE", "CANCELLED", "EXPIRED"],
  CLOSED: ["CLOSED_VERIFIED"],
};

function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}

describe("PTW state machine", () => {
  it("allows the normal approval flow", () => {
    expect(canTransition("DRAFT", "PENDING_APPROVAL")).toBe(true);
    expect(canTransition("PENDING_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "ACTIVE")).toBe(true);
  });

  it("allows suspend and resume", () => {
    expect(canTransition("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransition("SUSPENDED", "ACTIVE")).toBe(true);
  });

  it("allows closure verification", () => {
    expect(canTransition("ACTIVE", "CLOSED")).toBe(true);
    expect(canTransition("CLOSED", "CLOSED_VERIFIED")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("DRAFT", "ACTIVE")).toBe(false);
    expect(canTransition("REJECTED", "ACTIVE")).toBe(false);
    expect(canTransition("CLOSED_VERIFIED", "ACTIVE")).toBe(false);
  });
});
