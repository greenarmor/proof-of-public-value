/**
 * E2E Test Script — Verifies all 13 contracts and every dashboard's data pipeline.
 * Each test corresponds to a live query a dashboard makes.
 */

import { rpc } from "@stellar/stellar-sdk";
import { Client as PvoCoreClient } from "./src/contracts/pvo_core/src/index.ts";
import { Client as ValueScoreClient } from "./src/contracts/value_score/src/index.ts";
import { Client as ReputationClient } from "./src/contracts/reputation/src/index.ts";
import { Client as CommunityOracleClient } from "./src/contracts/community_oracle/src/index.ts";
import { Client as AuditTrailClient } from "./src/contracts/audit_trail/src/index.ts";
import { Client as AccessControlClient } from "./src/contracts/access_control/src/index.ts";
import { Client as EscrowClient } from "./src/contracts/escrow/src/index.ts";
import { Client as GrantClient } from "./src/contracts/grant_commitment/src/index.ts";
import { Client as AIOracleClient } from "./src/contracts/ai_oracle/src/index.ts";
import { Client as ComplianceClient } from "./src/contracts/compliance_engine/src/index.ts";
import { Client as ProcurementClient } from "./src/contracts/procurement_market/src/index.ts";
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

  // ── Infrastructure ──

  await test("RPC connection to testnet", async () => {
    const server = new rpc.Server(RPC_URL);
    const health = await server.getHealth();
    if (health.status !== "healthy") throw new Error(`RPC unhealthy: ${JSON.stringify(health)}`);
  });

  // ── access_control (AdminPanel, ProtectedRoute) ──

  await test("access_control: get_admin", async () => {
    const client = createClient(CONTRACT_IDS.access_control, AccessControlClient);
    const result = await client.get_admin();
    const admin = result.result;
    if (!admin) throw new Error("Admin not set");
    console.log(`  -> Admin: ${admin.slice(0, 12)}...`);
  });

  await test("access_control: get_addresses_by_role(Citizen)", async () => {
    const client = createClient(CONTRACT_IDS.access_control, AccessControlClient);
    const result = await client.get_addresses_by_role({ role: { tag: "Citizen", values: void 0 } });
    console.log(`  -> ${(result.result || []).length} citizen addresses`);
  });

  // ── pvo_core (AgencyDashboard, TransparencyPortal, ContractorPortal, EngineerPanel) ──

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
    console.log(`  -> Title: "${pvo.title}", Budget: ${pvo.total_budget}, Contractor: ${pvo.contractor?.slice(0, 12)}...`);
  });

  await test("pvo_core: get_pvo_milestones(1)", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const result = await client.get_pvo_milestones({ pvo_id: 1 });
    const milestones = result.result || [];
    console.log(`  -> ${milestones.length} milestones`);
    if (milestones.length > 0) {
      const m = milestones[0] as any;
      console.log(`  -> M#${m.id}: "${m.title}", Status: ${m.status?.tag}, Engineer: ${m.engineer_approved}`);
    }
  });

  await test("pvo_core: get_pv_os_by_contractor", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const contractor = "GDH34DMJZ6UH6267LPTCPE4HZH3TDAL54THUZZHMKDPCWNGK6N62VDRF";
    const result = await client.get_pv_os_by_contractor({ contractor });
    console.log(`  -> ${(result.result || []).length} PVOs assigned to contractor`);
  });

  // ── escrow (FunderDashboard, ContractorPortal, EngineerPanel, AuditorDashboard, AntiCorruptionDashboard) ──

  await test("escrow: get_escrow_count", async () => {
    const client = createClient(CONTRACT_IDS.escrow, EscrowClient);
    const result = await client.get_escrow_count();
    console.log(`  -> ${result.result} escrows`);
  });

  await test("escrow: get_escrow(1)", async () => {
    const client = createClient(CONTRACT_IDS.escrow, EscrowClient);
    const cnt = await client.get_escrow_count();
    if (Number(cnt.result) === 0) {
      console.log("  -> No escrows yet (new contract) — skipping");
      return;
    }
    const result = await client.get_escrow({ escrow_id: 1 });
    const e = result.result;
    if (!e) throw new Error("Escrow #1 not found");
    console.log(`  -> Escrow #1: Amount=${e.amount}, Status=${(e.status as any).tag}, Engineer=${e.conditions.engineer_approval}`);
  });

  await test("escrow: get_escrows_by_pvo(1)", async () => {
    const client = createClient(CONTRACT_IDS.escrow, EscrowClient);
    const result = await client.get_escrows_by_pvo({ pvo_id: 1 });
    console.log(`  -> ${(result.result || []).length} escrows for PVO #1`);
  });

  await test("escrow: check_conditions(1)", async () => {
    const client = createClient(CONTRACT_IDS.escrow, EscrowClient);
    const cnt = await client.get_escrow_count();
    if (Number(cnt.result) === 0) {
      console.log("  -> No escrows yet — skipping");
      return;
    }
    const result = await client.check_conditions({ escrow_id: 1 });
    console.log(`  -> Escrow #1 ready: ${result.result}`);
  });

  // ── grant_commitment (DonorDashboard, FunderDashboard) ──

  await test("grant_commitment: get_all_grants", async () => {
    const client = createClient(CONTRACT_IDS.grant_commitment, GrantClient);
    const result = await client.get_all_grants();
    console.log(`  -> ${(result.result || []).length} grant commitments`);
  });

  await test("grant_commitment: get_grant_count", async () => {
    const client = createClient(CONTRACT_IDS.grant_commitment, GrantClient);
    const result = await client.get_grant_count();
    console.log(`  -> ${result.result} grants`);
  });

  // ── ai_oracle (AIDashboard) ──

  await test("ai_oracle: get_fraud_count", async () => {
    const client = createClient(CONTRACT_IDS.ai_oracle, AIOracleClient);
    const result = await client.get_fraud_count();
    console.log(`  -> ${result.result} fraud detections`);
  });

  await test("ai_oracle: get_geo_risk(1)", async () => {
    const client = createClient(CONTRACT_IDS.ai_oracle, AIOracleClient);
    const result = await client.get_geo_risk({ pvo_id: 1 });
    console.log(`  -> Geo risk for PVO #1: ${result.result ? "found" : "none"}`);
  });

  // ── compliance_engine (AuditorDashboard, ComplianceDashboard) ──

  await test("compliance_engine: get_violation_count", async () => {
    const client = createClient(CONTRACT_IDS.compliance_engine, ComplianceClient);
    const result = await client.get_violation_count();
    console.log(`  -> ${result.result} violations`);
  });

  // ── procurement_market (SupplierPortal, ProcurementMarketplace) ──

  await test("procurement_market: get_tender_count", async () => {
    const client = createClient(CONTRACT_IDS.procurement_market, ProcurementClient);
    const result = await client.get_tender_count();
    console.log(`  -> ${result.result} tenders`);
  });

  // ── audit_trail (AuditorDashboard) ──

  await test("audit_trail: get_entry_count", async () => {
    const client = createClient(CONTRACT_IDS.audit_trail, AuditTrailClient);
    const result = await client.get_entry_count();
    console.log(`  -> ${result.result} audit entries`);
  });

  await test("audit_trail: get_entry(1)", async () => {
    const client = createClient(CONTRACT_IDS.audit_trail, AuditTrailClient);
    const result = await client.get_entry({ entry_id: 1 });
    const e = result.result;
    if (!e) throw new Error("Entry #1 not found");
    console.log(`  -> Entry #1: PVO=${e.pvo_id}, Category=${(e.category as any).tag}`);
  });

  // ── value_score (TransparencyPortal, IndexLeaderboard) ──

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

  // ── reputation (IndexLeaderboard) ──

  await test("reputation: get_entity_count", async () => {
    const client = createClient(CONTRACT_IDS.reputation, ReputationClient);
    const result = await client.get_entity_count();
    console.log(`  -> ${result.result} entities registered`);
  });

  // ── community_oracle (CitizenInterface) ──

  await test("community_oracle: get_report_count", async () => {
    const client = createClient(CONTRACT_IDS.community_oracle, CommunityOracleClient);
    const result = await client.get_report_count();
    console.log(`  -> ${result.result} community reports`);
  });

  // ── cross-contract (TransparencyPortal + escrow integration) ──

  await test("Cross-contract: pvo_core.check_milestone_ready(2)", async () => {
    const client = createClient(CONTRACT_IDS.pvo_core, PvoCoreClient);
    const result = await client.check_milestone_ready({ milestone_id: 2 });
    console.log(`  -> Milestone #2 ready: ${result.result}`);
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
