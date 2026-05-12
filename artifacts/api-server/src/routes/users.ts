import { Router } from "express";
import { db } from "@workspace/db";
import { platformUsersTable, artistsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest, requireSuperAdmin } from "../middlewares/auth";
import { getAuth, clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";

const router = Router();

// ── GET /users/me ────────────────────────────────────────────────────────────
router.get("/users/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const users = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.id, req.userId!));

    const user = users[0];

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    let tenant = null;
    if (user.tenantId) {
      const artists = await db
        .select()
        .from(artistsTable)
        .where(eq(artistsTable.id, user.tenantId));

      const artist = artists[0];
      if (artist) {
        tenant = {
          id: artist.id,
          name: artist.name,
          email: artist.email,
          availability: artist.availability,
        };
      }
    }

    res.json({
      id: user.id,
      clerkUserId: user.clerkUserId,
      role: user.role,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenant,
    });
  } catch (err: any) {
    logger.error({ err, userId: req.userId }, "[GET /users/me] Error");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ── POST /users/bootstrap-from-clerk ──────────────────────────────────────────
router.post("/users/bootstrap-from-clerk", async (req, res) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const clerkUserId = auth.userId;

  // ── Extract email & name from sessionClaims first ─────────────────────────
  let email = String(
    auth.sessionClaims?.email ||
      auth.sessionClaims?.primary_email_address ||
      ""
  )
    .trim()
    .toLowerCase();

  let name = String(
    auth.sessionClaims?.fullName ||
      auth.sessionClaims?.first_name ||
      auth.sessionClaims?.given_name ||
      ""
  ).trim();

  // ── Fallback: fetch from Clerk Backend API (needed for OAuth providers) ───
  if (!email) {
    try {
      logger.info(
        { clerkUserId },
        "[BOOTSTRAP] Email not in sessionClaims — fetching from Clerk API"
      );

      const clerkUser = await clerkClient.users.getUser(clerkUserId);

      // Primary email address
      const primaryEmail = clerkUser.emailAddresses?.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      );
      email = (primaryEmail?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || "")
        .trim()
        .toLowerCase();

      // Display name / full name
      if (!name) {
        name = (
          clerkUser.fullName ||
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          ""
        ).trim();
      }

      logger.info(
        { clerkUserId, email: email || "(empty)", name },
        "[BOOTSTRAP] Fetched from Clerk API"
      );
    } catch (clerkErr) {
      logger.error(
        { clerkErr, clerkUserId },
        "[BOOTSTRAP] Failed to fetch user from Clerk API"
      );
    }
  }

  // Final fallback for name
  if (!name) {
    name = "User";
  }

  logger.info(
    { clerkUserId, email: email || "(empty)", name },
    "[BOOTSTRAP] Starting bootstrap"
  );

  try {
    // ────────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Check if already exists by clerkUserId
    // ────────────────────────────────────────────────────────────────────────────

    logger.debug({ clerkUserId }, "[BOOTSTRAP] Checking by clerkUserId");

    const byClerkId = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.clerkUserId, clerkUserId));

    const existingByClerk = byClerkId[0];

    if (existingByClerk) {
      logger.info(
        { clerkUserId, role: existingByClerk.role },
        "[BOOTSTRAP] ✅ Already exists by clerkUserId"
      );
      res.status(200).json({
        ok: true,
        role: existingByClerk.role,
        userId: existingByClerk.id,
        alreadyOnboarded: true,
      });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Check if exists by email (pre-seeded)
    // ────────────────────────────────────────────────────────────────────────────

    let userByEmail: typeof platformUsersTable.$inferSelect | undefined;

    if (email) {
      logger.debug({ email }, "[BOOTSTRAP] Checking by email");

      const byEmail = await db
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.email, email));

      userByEmail = byEmail[0];
    }

    if (userByEmail) {
      logger.info(
        { clerkUserId, email, existingRole: userByEmail.role },
        "[BOOTSTRAP] Found by email — linking clerkUserId"
      );

      const updated = await db
        .update(platformUsersTable)
        .set({
          clerkUserId,
          name: name || userByEmail.name,
          updatedAt: new Date(),
        })
        .where(eq(platformUsersTable.id, userByEmail.id))
        .returning();

      const updatedUser = updated[0];

      logger.info(
        { clerkUserId, userId: updatedUser.id, role: updatedUser.role },
        "[BOOTSTRAP] ✅ Linked by email"
      );

      res.status(200).json({
        ok: true,
        role: updatedUser.role,
        userId: updatedUser.id,
        linkedByEmail: true,
      });
      return;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: New user — create as "client"
    // ────────────────────────────────────────────────────────────────────────────

    if (!email) {
      logger.warn({ clerkUserId }, "[BOOTSTRAP] No email — cannot create user");
      res.status(400).json({
        error: "Missing email",
        message: "Email is required",
      });
      return;
    }

    logger.info(
      { clerkUserId, email, name },
      "[BOOTSTRAP] Creating new user as client"
    );

    const inserted = await db
      .insert(platformUsersTable)
      .values({
        clerkUserId,
        email,
        name,
        role: "client",
        tenantId: null,
      })
      .returning();

    const newUser = inserted[0];

    logger.info(
      { clerkUserId, userId: newUser.id },
      "[BOOTSTRAP] ✅ New user created"
    );

    res.status(201).json({
      ok: true,
      role: "client",
      userId: newUser.id,
      justCreated: true,
    });
  } catch (err: any) {
    logger.error(
      {
        err,
        clerkUserId,
        email,
        errorMessage: err.message,
      },
      "[BOOTSTRAP] ❌ Failed"
    );

    if (err.message.includes("unique constraint")) {
      res.status(409).json({
        error: "Already exists",
        message: "User with this email already exists",
      });
      return;
    }

    res.status(500).json({
      error: "Bootstrap failed",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// ── POST /users/promote-by-email ──────────────────────────────────────────────
router.post("/users/promote-by-email", requireSuperAdmin, async (req: AuthRequest, res) => {
  try {
    const targetEmail = String((req.body as any)?.email ?? "").trim().toLowerCase();

    if (!targetEmail) {
      res.status(400).json({
        error: "Validation error",
        message: "Email is required",
      });
      return;
    }

    const byEmail = await db
      .select()
      .from(platformUsersTable)
      .where(eq(platformUsersTable.email, targetEmail));

    const user = byEmail[0];

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updated = await db
      .update(platformUsersTable)
      .set({ role: "superadmin", updatedAt: new Date() })
      .where(eq(platformUsersTable.id, user.id))
      .returning();

    const updatedUser = updated[0];

    logger.info(
      { email: updatedUser.email, role: updatedUser.role },
      "[PROMOTE] User promoted to superadmin"
    );

    res.json({
      ok: true,
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });
  } catch (err: any) {
    logger.error({ err }, "[PROMOTE] Error");
    res.status(500).json({ error: "Promotion failed" });
  }
});

// ── POST /users/bootstrap-admin ───────────────────────────────────────────────
router.post("/users/bootstrap-admin", requireAuth, async (req: AuthRequest, res) => {
  try {
    // Check if any superadmin exists
    const superadmins = await db
      .select({ id: platformUsersTable.id })
      .from(platformUsersTable)
      .where(eq(platformUsersTable.role, "superadmin"));

    if (superadmins.length > 0) {
      res.status(403).json({
        error: "Forbidden",
        message: "A superadmin already exists",
      });
      return;
    }

    // Promote current user
    const updated = await db
      .update(platformUsersTable)
      .set({ role: "superadmin", tenantId: null, updatedAt: new Date() })
      .where(eq(platformUsersTable.id, req.userId!))
      .returning();

    const promotedUser = updated[0];

    logger.info(
      { userId: req.userId },
      "[BOOTSTRAP-ADMIN] ✅ First user promoted to superadmin"
    );

    res.json({
      ok: true,
      message: "You are now the superadmin",
      role: "superadmin",
    });
  } catch (err: any) {
    logger.error({ err }, "[BOOTSTRAP-ADMIN] Error");
    res.status(500).json({ error: "Bootstrap failed" });
  }
});

export default router;