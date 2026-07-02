#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String, Vec};
use access_control::AccessControl;
use pvo_core::{PVOCore, EvidenceType};
use escrow::DynamicEscrow;
use community_oracle::CommunityOracle;
use reputation::{ReputationLedger, EntityType};
use audit_trail::AuditTrail;
use value_score::ValueScore;

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

struct FullSystem {
    env: Env,
    admin: Address,
    agency: Address,
    contractor: Address,
    engineer: Address,
    citizen: Address,
    router_client: PoPVRouterClient<'static>,
    ac_client: AccessControlClient<'static>,
    pvo_client: PVOCoreClient<'static>,
    escrow_client: DynamicEscrowClient<'static>,
    oracle_client: CommunityOracleClient<'static>,
    rep_client: ReputationLedgerClient<'static>,
    audit_client: AuditTrailClient<'static>,
}

fn setup_full_system() -> FullSystem {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(&env);
    let agency = Address::generate(&env);
    let contractor = Address::generate(&env);
    let engineer = Address::generate(&env);
    let citizen = Address::generate(&env);

    let ac_id = env.register(AccessControl, ());
    let pvo_id_addr = env.register(PVOCore, ());
    let escrow_id_addr = env.register(DynamicEscrow, ());
    let oracle_id_addr = env.register(CommunityOracle, ());
    let rep_id_addr = env.register(ReputationLedger, ());
    let audit_id_addr = env.register(AuditTrail, ());
    let value_id_addr = env.register(ValueScore, ());
    let router_id = env.register(PoPVRouter, ());

    let ac_client = AccessControlClient::new(&env, &ac_id);
    let pvo_client = PVOCoreClient::new(&env, &pvo_id_addr);
    let escrow_client = DynamicEscrowClient::new(&env, &escrow_id_addr);
    let oracle_client = CommunityOracleClient::new(&env, &oracle_id_addr);
    let rep_client = ReputationLedgerClient::new(&env, &rep_id_addr);
    let audit_client = AuditTrailClient::new(&env, &audit_id_addr);
    let value_client = ValueScoreClient::new(&env, &value_id_addr);
    let router_client = PoPVRouterClient::new(&env, &router_id);

    ac_client.initialize(&admin);
    pvo_client.initialize();
    escrow_client.initialize();
    oracle_client.initialize();
    rep_client.initialize();
    audit_client.initialize();
    value_client.initialize();

    let addresses = ContractAddresses {
        access_control: ac_id,
        pvo_core: pvo_id_addr,
        escrow: escrow_id_addr,
        community_oracle: oracle_id_addr,
        reputation: rep_id_addr,
        audit_trail: audit_id_addr,
        value_score: value_id_addr,
    };

    router_client.initialize(&admin, &addresses);

    FullSystem {
        env,
        admin,
        agency,
        contractor,
        engineer,
        citizen,
        router_client,
        ac_client,
        pvo_client,
        escrow_client,
        oracle_client,
        rep_client,
        audit_client,
    }
}

#[test]
fn test_router_initialization() {
    let system = setup_full_system();
    let addrs = system.router_client.get_addresses();
    assert_eq!(addrs.access_control, system.ac_client.address);
}

#[test]
fn test_create_project_full() {
    let system = setup_full_system();
    let required = Vec::from_array(&system.env, [EvidenceType::DroneImagery, EvidenceType::GpsCoordinates]);

    let (pvo_id, milestone_id, escrow_id) = system.router_client.create_project_full(
        &system.admin,
        &make_string(&system.env, "Highway Project"),
        &make_string(&system.env, "10km highway"),
        &system.agency,
        &system.contractor,
        &system.admin,
        &make_string(&system.env, "DPWH"),
        &make_string(&system.env, "Quezon City"),
        &10_000_000,
        &make_string(&system.env, "National Budget"),
        &make_string(&system.env, "Phase 1"),
        &make_string(&system.env, "Site prep"),
        &3_000_000,
        &required,
        &2,
        &2,
    );

    assert_eq!(pvo_id, 1);
    assert!(milestone_id > 0);
    assert!(escrow_id > 0);

    let escrow = system.escrow_client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.amount, 3_000_000);

    let audit_count = system.audit_client.get_entry_count();
    assert!(audit_count > 0);
}

#[test]
fn test_assign_role_via_router() {
    let system = setup_full_system();

    assert!(!system.router_client.check_role_wrapped(&system.contractor, &Role::Contractor));

    system.router_client.assign_role_wrapped(
        &system.admin,
        &system.contractor,
        &Role::Contractor,
    );

    assert!(system.router_client.check_role_wrapped(&system.contractor, &Role::Contractor));
}

#[test]
fn test_register_contractor_and_record() {
    let system = setup_full_system();

    system.router_client.register_contractor(&system.contractor);

    let record = system.rep_client.get_reputation(&system.contractor).unwrap();
    assert_eq!(record.entity_type, EntityType::Contractor);
    assert_eq!(record.reputation_score, 100);

    system.router_client.record_contractor_completion(
        &system.contractor,
        &90,
        &true,
        &true,
    );

    let updated = system.rep_client.get_reputation(&system.contractor).unwrap();
    assert_eq!(updated.completed_projects, 1);
}

#[test]
fn test_citizen_report_via_router() {
    let system = setup_full_system();

    let report_id = system.router_client.submit_citizen_report_wrapped(
        &system.citizen,
        &1,
        &1,
        &OracleReportType::GpsPhoto,
        &make_string(&system.env, "hash123"),
        &143000000_i128,
        &1210000000_i128,
    );

    assert!(report_id > 0);

    let report = system.oracle_client.get_report(&report_id).unwrap();
    assert_eq!(report.citizen, system.citizen);
}

#[test]
fn test_submit_evidence_and_approve() {
    let system = setup_full_system();
    let required = Vec::from_array(&system.env, [EvidenceType::DroneImagery, EvidenceType::GpsCoordinates]);

    let (_pvo_id, milestone_id, escrow_id) = system.router_client.create_project_full(
        &system.admin,
        &make_string(&system.env, "Bridge"),
        &make_string(&system.env, ""),
        &system.agency,
        &system.contractor,
        &system.admin,
        &make_string(&system.env, "DPWH"),
        &make_string(&system.env, "Manila"),
        &5_000_000,
        &make_string(&system.env, "Budget"),
        &make_string(&system.env, "M1"),
        &make_string(&system.env, ""),
        &2_000_000,
        &required,
        &1,
        &1,
    );

    system.router_client.submit_evidence_and_approve(
        &system.contractor,
        &system.engineer,
        &1,
        &milestone_id,
        &escrow_id,
        &EvidenceType::DroneImagery,
        &make_string(&system.env, "drone_hash"),
    );

    let milestone = system.pvo_client.get_milestone(&milestone_id).unwrap();
    assert!(milestone.engineer_approved);
}

#[test]
fn test_get_project_summary() {
    let system = setup_full_system();
    let required = Vec::from_array(&system.env, [EvidenceType::DroneImagery]);

    let (pvo_id, _mid, _eid) = system.router_client.create_project_full(
        &system.admin,
        &make_string(&system.env, "Road"),
        &make_string(&system.env, ""),
        &system.agency,
        &system.contractor,
        &system.admin,
        &make_string(&system.env, "DPWH"),
        &make_string(&system.env, "Cebu"),
        &5_000_000,
        &make_string(&system.env, "Budget"),
        &make_string(&system.env, "M1"),
        &make_string(&system.env, ""),
        &2_000_000,
        &required,
        &1,
        &1,
    );

    system.router_client.register_contractor(&system.contractor);

    let summary = system.router_client.get_project_summary(&pvo_id, &system.contractor);

    assert_eq!(summary.pvo_title, make_string(&system.env, "Road"));
    assert_eq!(summary.milestone_count, 1);
    assert_eq!(summary.released_count, 0);
    assert_eq!(summary.contractor_reputation, 100);
}

#[test]
fn test_full_end_to_end_workflow() {
    let system = setup_full_system();
    let required = Vec::from_array(&system.env, [EvidenceType::DroneImagery, EvidenceType::GpsCoordinates]);

    let (pvo_id, milestone_id, escrow_id) = system.router_client.create_project_full(
        &system.admin,
        &make_string(&system.env, "School Building"),
        &make_string(&system.env, "3-classroom building"),
        &system.agency,
        &system.contractor,
        &system.admin,
        &make_string(&system.env, "DepEd"),
        &make_string(&system.env, "Davao"),
        &8_000_000,
        &make_string(&system.env, "Budget"),
        &make_string(&system.env, "Construction"),
        &make_string(&system.env, "Build classrooms"),
        &5_000_000,
        &required,
        &2,
        &2,
    );

    system.router_client.register_contractor(&system.contractor);

    system.router_client.submit_evidence_and_approve(
        &system.contractor,
        &system.engineer,
        &pvo_id,
        &milestone_id,
        &escrow_id,
        &EvidenceType::DroneImagery,
        &make_string(&system.env, "drone_1"),
    );

    system.pvo_client.submit_evidence(
        &system.contractor,
        &pvo_id,
        &milestone_id,
        &EvidenceType::GpsCoordinates,
        &make_string(&system.env, "gps_1"),
        &make_string(&system.env, ""),
    );

    system.router_client.validate_and_compliance(
        &system.admin,
        &pvo_id,
        &milestone_id,
        &escrow_id,
        &true,
        &true,
    );

    system.router_client.add_community_verifications(
        &pvo_id,
        &milestone_id,
        &escrow_id,
        &2,
    );

    let completed = system.router_client.complete_milestone_full(
        &system.admin,
        &pvo_id,
        &milestone_id,
        &escrow_id,
        &system.contractor,
        &85,
    );

    assert!(completed);

    let milestone = system.pvo_client.get_milestone(&milestone_id).unwrap();
    assert_eq!(milestone.status, MilestoneStatus::Released);

    let escrow = system.escrow_client.get_escrow(&escrow_id).unwrap();
    assert_eq!(escrow.status, escrow::EscrowStatus::Released);

    let pvo = system.pvo_client.get_pvo(&pvo_id).unwrap();
    assert_eq!(pvo.public_value_score, 85);

    let summary = system.router_client.get_project_summary(&pvo_id, &system.contractor);
    assert_eq!(summary.released_count, 1);
    assert_eq!(summary.value_score, 85);

    let audit_entries = system.audit_client.get_pvo_audit_history(&pvo_id);
    assert!(audit_entries.len() >= 3);
}

#[test]
fn test_complete_milestone_not_ready_returns_false() {
    let system = setup_full_system();
    let required = Vec::from_array(&system.env, [EvidenceType::DroneImagery]);

    let (pvo_id, milestone_id, escrow_id) = system.router_client.create_project_full(
        &system.admin,
        &make_string(&system.env, "Test"),
        &make_string(&system.env, ""),
        &system.agency,
        &system.contractor,
        &system.admin,
        &make_string(&system.env, "DPWH"),
        &make_string(&system.env, "QC"),
        &5_000_000,
        &make_string(&system.env, "Budget"),
        &make_string(&system.env, "M1"),
        &make_string(&system.env, ""),
        &2_000_000,
        &required,
        &2,
        &2,
    );

    let completed = system.router_client.complete_milestone_full(
        &system.admin,
        &pvo_id,
        &milestone_id,
        &escrow_id,
        &system.contractor,
        &80,
    );

    assert!(!completed);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize_router() {
    let system = setup_full_system();
    let addrs = system.router_client.get_addresses();
    system.router_client.initialize(&system.admin, &addrs);
}
