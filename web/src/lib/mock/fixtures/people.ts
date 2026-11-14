import { mock } from "../registry";
import { olderStage } from "../timeline";

// Preview data for invitations and the access log. Creating a link returns
// PREVIEW_INVITE_TOKEN, and the invite page accepts it even when a live API
// answers 404 for it (see app/invite/[token]/page.tsx).
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const EMILY = "00000000-0000-4000-8000-0000000000e1";

export const PREVIEW_INVITE_TOKEN = "preview-token";

export const previewInvitation = () => ({
  role: "nanny" as const, displayName: "Maria", permissions: ["care_log" as const, "baby_passport" as const, "schedule" as const], status: "pending" as const, invitedByName: "Emily", expiresAt: ahead(6),
});

export const peopleMocks = {
  // Maria and Grandma Linda belong to the pregnancy demo; the other families have not invited anyone.
  ...mock("/members/{memberId}/invitations", "get", async (ctx) => ({
    items: olderStage(await ctx.family()) ? [] : [
      { id: "00000000-0000-4000-8000-0000000001a1", role: "nanny" as const, displayName: "Maria", permissions: ["care_log" as const, "baby_passport" as const, "schedule" as const], status: "accepted" as const, invitedById: EMILY, memberId: "00000000-0000-4000-8000-0000000001b1", createdAt: ago(60 * 24 * 5), expiresAt: ahead(2), acceptedAt: ago(60 * 24 * 5 - 30) },
      { id: "00000000-0000-4000-8000-0000000001a2", role: "grandparent" as const, displayName: "Grandma Linda", permissions: ["care_log" as const, "baby_passport" as const, "schedule" as const, "pregnancy_updates" as const], status: "pending" as const, invitedById: EMILY, createdAt: ago(60 * 3), expiresAt: ahead(6) },
    ],
  })),
  ...mock("/members/{memberId}/invitations", "post", (ctx) => ({
    invitation: { id: crypto.randomUUID(), role: ctx.body.role, displayName: ctx.body.displayName, permissions: ctx.body.permissions, status: "pending" as const, invitedById: ctx.path.memberId, createdAt: new Date().toISOString(), expiresAt: ahead(7) },
    token: PREVIEW_INVITE_TOKEN,
    path: `/invite/${PREVIEW_INVITE_TOKEN}`,
  })),
  ...mock("/members/{memberId}/invitations/{invitationId}/revoke", "post", (ctx) => ({
    id: ctx.path.invitationId, role: "nanny" as const, displayName: "Maria", permissions: ["care_log" as const], status: "revoked" as const, invitedById: EMILY, createdAt: ago(60), expiresAt: ahead(6), revokedAt: new Date().toISOString(),
  })),
  ...mock("/invitations/{token}", "get", () => previewInvitation()),
  ...mock("/members/{memberId}/access-log", "get", async (ctx) => ({
    items: olderStage(await ctx.family()) ? [] : [
      { id: "l1", actorId: "00000000-0000-4000-8000-0000000001b1", actorName: "Maria", actorRole: "nanny" as const, action: "read", entity: "child_passport", at: ago(35) },
      { id: "l2", actorId: "00000000-0000-4000-8000-0000000001b1", actorName: "Maria", actorRole: "nanny" as const, action: "create", entity: "care_log_entry", at: ago(130) },
      { id: "l3", actorId: EMILY, actorName: "Emily", actorRole: "mother" as const, action: "create", entity: "invitation", at: ago(60 * 3) },
    ],
  })),
};
