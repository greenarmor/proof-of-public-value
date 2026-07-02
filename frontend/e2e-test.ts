/**
 * E2E Test Script — Verifies all 7 contract clients can query testnet contracts.
 * Simulates the frontend Transparency Portal's data fetching flow.
 */

import { rpc } from "@stellar/stellar-sdk";
import { Client as PvoCoreClient } from "./src/contracts/pvo_core/src/index.ts";
import { Client as ValueScoreClient } from "./src/contracts/value_score/src/index.ts";
import { Client as ReputationClient } from "./src/contracts/reputation/src/index.ts";
import { Client as CommunityOracleClient } from "./src/contracts/community_oracle/src/index.ts";
import { Client as AuditTrailClient } from "./src/contracts/audit_trail/src/index.ts";
import { Client as AccessControlClient } from "./src/contracts/access_control/src/index.ts";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "./src/config.ts";

const PASS = "✅";
const FAIL = "❌";
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`${PASS} ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`${FAIL} ${name}: ${e.message || e}`);
    failed++;
  }
}

function createClient(contractId: string, ClientClass: any) {
  return new ClientClass({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
  });
}

async function main() {
  console.log("=== PoPV E2E Test Suite ===\n");
  console.log(`Network: ${NETWORK_PASSPHRASE}`);
  console.log(`RPC: ${RPC_URL}\n`);

  // 1. Verify RPC connection
  await test("RPC connection to testnet", async () => {
    const server = new rpc.Server(RPC_URL);
    const health = await server.getHealth();
    if (health.status !== "healthy") throw new Error(`RPC unhealthy: ${JSON.stringify(health)}`);
  });

  // 2. PVO Core — get_pvo_count + get_pvo
  await test("pvo_core: get_pvo_count", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const result = await client.get_pvo_count();
    if (typeof result.result !== "number" && typeof result.result !== "bigint")
      throw new Error(`Unexpected result type: ${typeof result.result}`);
    console.log(`  -> ${result.result} PVOs on-chain`);
  });

  await test("pvo_core: get_pvo(1)", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const result = await client.get_pvo({ pvo_id: 1 });
    const pvo = result.result;
    if (!pvo) throw new Error("PVO #1 not found");
    if (!pvo.title) throw new Error("PVO title is empty");
    console.log(`  -> Title: "${pvo.title}", Budget: ${pvo.total_budget}, Status: ${pvo.status.tag}`);
  });

  // 3. Value Score
  await test("value_score: get_score(1)", async () => {
    const client = createClient(CONTRACT_IDS.value_score, ValueScoreClient);
    const result = await client.get_score({ pvo_id: 1 });
    const score = result.result;
    console.log(`  -> Overall: ${score?.overall_score || 0}, Evaluations: ${score?.total_evaluations || 0}`);
  });

  await test("value_score: get_scored_pvo_count", async () => {
    const client = createClient(CONTRACT_IDS.value_score, ValueScoreClient);
    const result = await client.get_scored_pvo_count();
    console.log(`  -> ${result.result} scored PVOs`);
  });

  // 4. Reputation
  await test("reputation: get_entity_count", async () => {
    const client = createClient(CONTRACT_IDS.reputation, ReputationClient);
    const result = await client.get_entity_count();
    console.log(`  -> ${result.result} entities registered`);
  });

  // 5. Community Oracle
  await test("community_oracle: get_report_count", async () => {
    const client = createClient(CONTRACT_IDS.community_oracle, CommunityOracleClient);
    const result = await client.get_report_count();
    console.log(`  -> ${result.result} community reports`);
  });

  // 6. Audit Trail
  await test("audit_trail: get_entry_count", async () => {
    const client = createClient(CONTRACT_IDS.audit_trail, AuditTrailClient);
    const result = await client.get_entry_count();
    console.log(`  -> ${result.result} audit entries`);
  });

  // 7. Access Control
  await test("access_control: get_admin", async () => {
    const client = createClient(CONTRACT_IDS.access_control, AccessControlClient);
    const result = await client.get_admin();
    const admin = result.result;
    console.log(`  -> Admin: ${admin?.slice(0, 12)}...`);
  });

  // 8. Read pvo from Transparency Portal style (bulk load)
  await test("Bulk PVO load (Transparency Portal simulation)", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const countResult = await client.get_pvo_count();
    const count = Number(countResult.result);
    console.log(`  -> Loading ${count} PVOs...`);
    for (let i = 1; i <= count; i++) {
      const result = await client.get_pvo({ pvo_id: i });
      if (result.result) {
        console.log(`  -> PVO #${i}: "${result.result.title}" [${result.result.department}]`);
      }
    }
  });

  // 9. Cross-contract read flow (milestone check)
  await test("Cross-contract: check_milestone_ready", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const result = await client.check_milestone_ready({ milestone_id: 2 });
    console.log(`  -> Milestone #2 ready: ${result.result}`);
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
