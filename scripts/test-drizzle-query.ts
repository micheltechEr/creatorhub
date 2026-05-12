// scripts/test-drizzle-query.ts
// Execute com: npx ts-node scripts/test-drizzle-query.ts

import { db } from "@workspace/db";
import { platformUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../src/lib/logger";

async function testDrizzle() {
  try {
    console.log("🔍 [TEST] Iniciando teste de query Drizzle vs pg direto\n");

    // ────────────────────────────────────────────────────────────────────────────
    // TEST 1: SELECT * sem filtro (deve retornar todos)
    // ────────────────────────────────────────────────────────────────────────────
    
    console.log("TEST 1: SELECT * (sem filtro)");
    try {
      const allUsers = await db
        .select()
        .from(platformUsersTable)
        .limit(5);
      
      console.log(`✅ Sucesso! Encontrou ${allUsers.length} usuários`);
      allUsers.forEach((u: any) => {
        console.log(`  - ID: ${u.id}, clerkUserId: ${u.clerkUserId}, email: ${u.email}`);
      });
    } catch (err: any) {
      console.error(`❌ Erro: ${err.message}\n`);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // TEST 2: Query com WHERE (filtro por email)
    // ────────────────────────────────────────────────────────────────────────────
    
    console.log("\nTEST 2: SELECT WHERE email (filtro simples)");
    try {
      const [user] = await db
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.email, "test-000000@debug.local"))
        .limit(1);
      
      if (user) {
        console.log(`✅ Encontrou por email: ${user.email}`);
      } else {
        console.log(`⚠️ Nenhum usuário com esse email (esperado)`);
      }
    } catch (err: any) {
      console.error(`❌ Erro: ${err.message}\n`);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // TEST 3: Query com WHERE (filtro por clerkUserId - CRÍTICO)
    // ────────────────────────────────────────────────────────────────────────────
    
    console.log("\nTEST 3: SELECT WHERE clerkUserId (CRÍTICO)");
    const testClerkId = "user_3DKnDpAWEl8W8EgjnAGlkNa6X83";
    
    try {
      console.log(`  Procurando por clerkUserId: ${testClerkId}`);
      
      const [user] = await db
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.clerkUserId, testClerkId))
        .limit(1);
      
      if (user) {
        console.log(`✅ Encontrou: ${user.id} (${user.email})`);
      } else {
        console.log(`⚠️ Nenhum usuário com esse clerkUserId (esperado se não inseriu)`);
      }
    } catch (err: any) {
      console.error(`❌ ERRO CRÍTICO: ${err.message}`);
      console.error(`    Code: ${err.code}`);
      console.error(`    Detail: ${err.detail}\n`);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // TEST 4: Query direto com pg pool (sem Drizzle)
    // ────────────────────────────────────────────────────────────────────────────
    
    console.log("\nTEST 4: Query direto com pg pool (não-Drizzle)");
    try {
      // Se você tem acesso ao pool direto
      // const result = await db.pool.query(
      //   "SELECT id, clerk_user_id, email FROM platform_users WHERE clerk_user_id = $1 LIMIT 1",
      //   [testClerkId]
      // );
      // console.log(`✅ Pool query retornou ${result.rows.length} rows`);
      
      console.log("⚠️ (Pulado - requer acesso ao pool direto)");
    } catch (err: any) {
      console.error(`❌ Erro: ${err.message}\n`);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // TEST 5: INSERT novo usuário e depois SELECT
    // ────────────────────────────────────────────────────────────────────────────
    
    console.log("\nTEST 5: INSERT + SELECT (ciclo completo)");
    try {
      const testId = `user_test_${Date.now()}`;
      const testEmail = `test-${Date.now()}@drizzle-test.local`;
      
      console.log(`  Inserindo: clerkUserId=${testId}, email=${testEmail}`);
      
      const [inserted] = await db
        .insert(platformUsersTable)
        .values({
          clerkUserId: testId,
          email: testEmail,
          name: "Drizzle Test",
          role: "client",
          tenantId: null,
        })
        .returning();
      
      console.log(`✅ Insert bem-sucedido: ${inserted.id}`);
      
      // Agora tentar SELECT desse novo usuário
      console.log(`  Procurando por clerkUserId=${testId}...`);
      
      const [found] = await db
        .select()
        .from(platformUsersTable)
        .where(eq(platformUsersTable.clerkUserId, testId))
        .limit(1);
      
      if (found) {
        console.log(`✅ SELECT funcionou: encontrou ${found.id}`);
      } else {
        console.log(`❌ SELECT falhou: não encontrou o usuário que acabamos de inserir!`);
      }
    } catch (err: any) {
      console.error(`❌ Erro: ${err.message}\n`);
    }

    console.log("\n🏁 Testes finalizados!");
    process.exit(0);
  } catch (err: any) {
    console.error("❌ Erro não tratado:", err.message);
    process.exit(1);
  }
}

testDrizzle();