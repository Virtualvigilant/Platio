import { describe, expect, it } from "vitest";
import {
  READINESS_KEYS,
  WIZARD_STEPS,
  isReadyToPublish,
  stepForReadiness,
  stepState,
  type ReadinessCheck,
} from "./wizard";

const checks = (failing: string[]): ReadinessCheck[] =>
  READINESS_KEYS.map((key) => ({ key, ok: !failing.includes(key), message: `${key} message` }));

describe("wizard", () => {
  it("has the brief's eight steps, each readiness check on exactly one step", () => {
    expect(WIZARD_STEPS).toHaveLength(8);
    for (const key of READINESS_KEYS) {
      expect(
        WIZARD_STEPS.filter((s) => (s.readiness as readonly string[]).includes(key)),
      ).toHaveLength(1);
    }
    expect(new Set(WIZARD_STEPS.map((s) => s.slug)).size).toBe(8);
  });

  it("points each problem at the step that fixes it", () => {
    expect(stepForReadiness("operations")).toBe("hours");
    expect(stepForReadiness("team")).toBe("team");
  });

  it("marks steps done, to do, or without checks", () => {
    const c = checks(["operations", "team"]);
    expect(stepState("details", c)).toBe("done");
    expect(stepState("hours", c)).toBe("todo");
    expect(stepState("branding", c)).toBe("none");
    expect(isReadyToPublish(c)).toBe(false);
    expect(isReadyToPublish(checks([]))).toBe(true);
    expect(isReadyToPublish([])).toBe(false);
  });
});
