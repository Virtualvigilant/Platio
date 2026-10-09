import { describe, expect, it } from "vitest";
import {
  canManageMember,
  emailMatchesHint,
  formatDay,
  formatDayAndTime,
  invitationLink,
  invitationState,
  isPlausibleInvitationToken,
  memberName,
  sortInvitations,
  teamPowers,
} from "./model";

describe("teamPowers", () => {
  it("lets super-admins invite and manage every role", () => {
    expect(teamPowers({ platformRole: "super_admin", restaurantRole: null })).toEqual({
      invite: ["owner", "manager", "staff"],
      revoke: ["owner", "manager", "staff"],
      manage: ["owner", "manager", "staff"],
    });
  });

  it("lets support staff invite and revoke any role but not change or remove members", () => {
    expect(teamPowers({ platformRole: "support", restaurantRole: null })).toEqual({
      invite: ["owner", "manager", "staff"],
      revoke: ["owner", "manager", "staff"],
      manage: [],
    });
  });

  it("limits owners to managers and staff", () => {
    expect(teamPowers({ platformRole: null, restaurantRole: "owner" })).toEqual({
      invite: ["manager", "staff"],
      revoke: ["manager", "staff"],
      manage: ["manager", "staff"],
    });
  });

  it("gives managers and staff no team powers", () => {
    for (const role of ["manager", "staff"] as const) {
      expect(teamPowers({ platformRole: null, restaurantRole: role })).toEqual({
        invite: [],
        revoke: [],
        manage: [],
      });
    }
  });

  it("keeps the wider platform powers for staff who are also owners", () => {
    const powers = teamPowers({ platformRole: "support", restaurantRole: "owner" });
    expect(powers.invite).toEqual(["owner", "manager", "staff"]);
    expect(powers.manage).toEqual(["manager", "staff"]);
  });
});

describe("canManageMember", () => {
  const owner = teamPowers({ platformRole: null, restaurantRole: "owner" });
  const admin = teamPowers({ platformRole: "super_admin", restaurantRole: null });

  it("allows owners to manage managers and staff only", () => {
    expect(canManageMember(owner, { role: "staff", userId: "u2" }, "u1")).toBe(true);
    expect(canManageMember(owner, { role: "manager", userId: "u2" }, "u1")).toBe(true);
    expect(canManageMember(owner, { role: "owner", userId: "u2" }, "u1")).toBe(false);
  });

  it("never lets people change or remove themselves", () => {
    expect(canManageMember(admin, { role: "staff", userId: "u1" }, "u1")).toBe(false);
  });

  it("lets super-admins manage owners", () => {
    expect(canManageMember(admin, { role: "owner", userId: "u2" }, "u1")).toBe(true);
  });
});

describe("memberName", () => {
  it("prefers the display name, then the email", () => {
    expect(memberName({ displayName: " Wanjiku ", email: "w@example.com" })).toBe("Wanjiku");
    expect(memberName({ displayName: "  ", email: "w@example.com" })).toBe("w@example.com");
    expect(memberName({ displayName: null, email: null })).toBe("Unnamed account");
  });
});

describe("invitationState", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const base = { acceptedAt: null, revokedAt: null, expiresAt: "2026-10-16T12:00:00Z" };

  it("is pending until it expires", () => {
    expect(invitationState(base, now)).toBe("pending");
    expect(invitationState({ ...base, expiresAt: "2026-10-09T12:00:00Z" }, now)).toBe("expired");
  });

  it("puts revoked before accepted before expired, like the database", () => {
    const old = { expiresAt: "2026-10-01T00:00:00Z" };
    expect(
      invitationState(
        { ...base, ...old, revokedAt: "2026-09-30T00:00:00Z", acceptedAt: "2026-09-29T00:00:00Z" },
        now,
      ),
    ).toBe("revoked");
    expect(invitationState({ ...base, ...old, acceptedAt: "2026-09-29T00:00:00Z" }, now)).toBe(
      "accepted",
    );
  });
});

describe("sortInvitations", () => {
  it("lists pending invitations first, newest first within each group", () => {
    const list = [
      { id: "a", state: "expired" as const, createdAt: "2026-10-05T00:00:00Z" },
      { id: "b", state: "pending" as const, createdAt: "2026-10-01T00:00:00Z" },
      { id: "c", state: "accepted" as const, createdAt: "2026-10-07T00:00:00Z" },
      { id: "d", state: "pending" as const, createdAt: "2026-10-08T00:00:00Z" },
    ];
    expect(sortInvitations(list).map((i) => i.id)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("invitationLink", () => {
  it("joins the site address and the token without a double slash", () => {
    expect(invitationLink("https://dineflow.example/", "abc123")).toBe(
      "https://dineflow.example/invitations/abc123",
    );
    expect(invitationLink("http://localhost:3000", "abc")).toBe(
      "http://localhost:3000/invitations/abc",
    );
  });
});

describe("isPlausibleInvitationToken", () => {
  it("accepts tokens shaped like the database's and rejects anything else", () => {
    expect(isPlausibleInvitationToken("a".repeat(64))).toBe(true);
    expect(isPlausibleInvitationToken("0123456789abcdef".repeat(4))).toBe(true);
    expect(isPlausibleInvitationToken("short")).toBe(false);
    expect(isPlausibleInvitationToken(`${"a".repeat(40)}/../x`)).toBe(false);
    expect(isPlausibleInvitationToken("a".repeat(200))).toBe(false);
  });
});

describe("emailMatchesHint", () => {
  it("matches the first two characters and the domain", () => {
    expect(emailMatchesHint("owner@example.com", "ow•••@example.com")).toBe(true);
    expect(emailMatchesHint("Owner@Example.com", "ow•••@example.com")).toBe(true);
    expect(emailMatchesHint("other@example.com", "ow•••@example.com")).toBe(false);
    expect(emailMatchesHint("owner@example.org", "ow•••@example.com")).toBe(false);
    expect(emailMatchesHint(null, "ow•••@example.com")).toBe(false);
  });

  it("copes with one-letter local parts", () => {
    expect(emailMatchesHint("a@x.co", "a@•••@x.co")).toBe(true);
  });
});

describe("dates", () => {
  it("formats days and times in Nairobi time", () => {
    // 22:30 UTC is 01:30 the next day in Nairobi.
    expect(formatDay("2026-10-15T22:30:00Z")).toBe("16 Oct");
    expect(formatDay("2026-10-15T22:30:00Z", true)).toBe("16 Oct 2026");
    expect(formatDayAndTime("2026-10-15T22:30:00Z")).toBe("16 Oct at 01:30");
  });
});
