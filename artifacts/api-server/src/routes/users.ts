import { Router } from "express";
import { db } from "@workspace/db";
import { platformUsersTable, artistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { getAuth } from "@clerk/express";

const router = Router();

// ── GET /users/me — current user role + profile ───────────────────────────────
router.get("/users/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.id, req.userId!))
    .limit(1);

  if (!user[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const u = user[0];

  let tenant = null;
  if (u.tenantId) {
    const [t] = await db
      .select()
      .from(artistsTable)
      .where(eq(artistsTable.id, u.tenantId))
      .limit(1);
    if (t) {
      tenant = {
        id: t.id,
        name: t.name,
        email: t.email,
        availability: t.availability,
        isActive: (t as any).isActive ?? true,
      };
    }
  }

  res.json({
    id: u.id,
    role: u.role,
    email: u.email,
    name: u.name,
    tenantId: u.tenantId,
    tenant,
  });
});

router.post("/users/bootstrap-from-clerk", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const email = String(
    auth.sessionClaims?.email ||
    auth.sessionClaims?.primary_email_address ||
    ""
  );
  const name = String(
    auth.sessionClaims?.fullName ||
    auth.sessionClaims?.first_name ||
    auth.sessionClaims?.given_name ||
    "Usuário"
  );

  // Already linked by Clerk ID
  const [byClerkId] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.clerkUserId, auth.userId))
    .limit(1);

  if (byClerkId) {
    res.json({ ok: true, role: byClerkId.role });
    return;
  }

  // Pre-seeded record (e.g. pending:email) — link real Clerk ID and preserve role
  if (email) {
    const [byEmail] = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.email, email))
      .limit(1);

    if (byEmail) {
      await db
        .update(platformUsersTable)
        .set({ clerkUserId: auth.userId, name, updatedAt: new Date() })
        .where(eq(platformUsersTable.id, byEmail.id));

      res.json({ ok: true, role: byEmail.role });
      return;
    }
  }

  // Brand new user — create as client
  await db.insert(platformUsersTable).values({
    clerkUserId: auth.userId,
    email,
    name,
    role: "client",
    tenantId: null,
  });

  res.status(201).json({ ok: true, role: "client" });
});

router.post("/users/promote-by-email", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [actor] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.clerkUserId, auth.userId))
    .limit(1);

  if (!actor || actor.role !== "superadmin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const email = String((req.body as any)?.email ?? "").trim().toLowerCase();
  if (!email) {
    res.status(400).json({ error: "Validation error", message: "Email é obrigatório" });
    return;
  }

  const [user] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.email, email))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [updated] = await db
    .update(platformUsersTable)
    .set({ role: "superadmin", updatedAt: new Date() })
    .where(eq(platformUsersTable.id, user.id))
    .returning();

  res.json({ ok: true, id: updated.id, email: updated.email, role: updated.role });
});

// ── POST /users/bootstrap-admin — promote first user to superadmin ─────────────
// Only works if NO superadmin exists yet. Used for initial platform setup.
router.post("/users/bootstrap-admin", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check if any superadmin exists
  const [existing] = await db
    .select({ id: platformUsersTable.id })
    .from(platformUsersTable)
    .where(eq(platformUsersTable.role, "superadmin"))
    .limit(1);

  if (existing) {
    res.status(403).json({
      error: "Forbidden",
      message: "Um superadmin já existe. Entre em contato com o administrador para receber acesso.",
    });
    return;
  }

  // Find this user's platform_users record
  const [user] = await db
    .select()
    .from(platformUsersTable)
    .where(eq(platformUsersTable.clerkUserId, auth.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found", message: "Complete o cadastro primeiro" });
    return;
  }

  // Promote to superadmin
  await db
    .update(platformUsersTable)
    .set({ role: "superadmin", tenantId: null, updatedAt: new Date() })
    .where(eq(platformUsersTable.id, user.id));

  res.json({
    message: "Parabéns! Você agora é o superadmin da plataforma.",
    role: "superadmin",
  });
});

export default router;
