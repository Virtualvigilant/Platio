import { describe, expect, it } from "vitest";
import { PAYMENT_ONBOARDING_STATUSES } from "@/domain/restaurants/config";
import {
  ONBOARDING_LABELS,
  ONBOARDING_STATUSES,
  isOnboardingStatus,
  looksLikeSecret,
} from "./model";

describe("onboarding statuses", () => {
  it("match the domain schema and each has a label", () => {
    expect([...ONBOARDING_STATUSES]).toEqual([...PAYMENT_ONBOARDING_STATUSES]);
    expect(ONBOARDING_LABELS).toEqual({
      not_started: "Not started",
      in_progress: "In progress",
      ready: "Ready",
    });
  });

  it("recognises only known statuses", () => {
    expect(isOnboardingStatus("ready")).toBe(true);
    expect(isOnboardingStatus("live")).toBe(false);
    expect(isOnboardingStatus(undefined)).toBe(false);
  });
});

describe("looksLikeSecret", () => {
  it("accepts public references and provider names", () => {
    for (const value of [
      "",
      "123456",
      "Till 5123456",
      "Paybill 247247, account 0712345678",
      "M-Pesa",
      "Pesapal",
      "MID-00012345",
      "4f1c2a9e-6b1d-4c1a-9a51-0e1f2d3c4b5a",
    ]) {
      expect(looksLikeSecret(value), value).toBe(false);
    }
  });

  it("refuses keys, passwords and PINs", () => {
    for (const value of [
      "sk_live_51HxQ2bC3dE4fG5hI6jK7lM8",
      "rk_test_abc",
      "password: hunter2",
      "PIN 4321",
      "consumer secret here",
      "API key 1234",
      "-----BEGIN PRIVATE KEY-----",
      "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
      "dGhpcyBpcyBhIHNlY3JldCBrZXkgMTIzNDU2Nzg5MA==",
      "AKIAIOSFODNN7EXAMPLE",
    ]) {
      expect(looksLikeSecret(value), value).toBe(true);
    }
  });
});
