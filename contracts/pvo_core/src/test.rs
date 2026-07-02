#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String, Vec};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, PVOCoreClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PVOCore, ());
    let client = PVOCoreClient::new(&env, &contract_id);
    client.initialize();
    (env, client)
}

fn create_test_pvo(env: &Env, client: &PVOCoreClient) -> u32 {
    let creator = Address::generate(env);
    let agency = Address::generate(env);
    let contractor = Address::generate(env);
    let pm = Address::generate(env);

    client.create_pvo(
        &creator,
        &make_string(env, "Road Paving Project"),
        &make_string(env, "Paving 10km of national road"),
        &agency,
        &contractor,
        &pm,
        &make_string(env, "DPWH"),
        &make_string(env, "Quezon City"),
        &10_000_000,
        &make_string(env, "National Budget 2026"),
    )
}

#[test]
fn test_initialize() {
    let (_env, _client) = setup();
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let (_env, client) = setup();
    client.initialize();
}

#[test]
fn test_create_pvo() {
    let (env, client) = setup();
    let id = create_test_pvo(&env, &client);

    let pvo = client.get_pvo(&id).unwrap();
    assert_eq!(pvo.title, make_string(&env, "Road Paving Project"));
    assert_eq!(pvo.status, PVOStatus::Proposed);
    assert_eq!(pvo.total_budget, 10_000_000);
    assert_eq!(pvo.public_value_score, 0);
}

#[test]
fn test_update_pvo_status() {
    let (env, client) = setup();
    let id = create_test_pvo(&env, &client);

    let updater = Address::generate(&env);
    client.update_pvo_status(&updater, &id, &PVOStatus::Approved);

    let pvo = client.get_pvo(&id).unwrap();
    assert_eq!(pvo.status, PVOStatus::Approved);
}

#[test]
fn test_update_value_score() {
    let (env, client) = setup();
    let id = create_test_pvo(&env, &client);

    client.update_value_score(&id, &85);
    let pvo = client.get_pvo(&id).unwrap();
    assert_eq!(pvo.public_value_score, 85);
}

#[test]
fn test_create_milestone() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery, EvidenceType::GpsCoordinates]);

    let mid = client.create_milestone(
        &creator,
        &pvo_id,
        &make_string(&env, "Site Preparation"),
        &make_string(&env, "Clear and grade the site"),
        &3_000_000,
        &required,
        &3,
    );

    let milestone = client.get_milestone(&mid).unwrap();
    assert_eq!(milestone.title, make_string(&env, "Site Preparation"));
    assert_eq!(milestone.budget, 3_000_000);
    assert_eq!(milestone.status, MilestoneStatus::Pending);
    assert_eq!(milestone.community_required, 3);
}

#[test]
#[should_panic(expected = "milestone budget exceeds PVO total budget")]
fn test_milestone_budget_exceeds_pvo() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery]);

    client.create_milestone(
        &creator,
        &pvo_id,
        &make_string(&env, "Over Budget"),
        &make_string(&env, ""),
        &20_000_000,
        &required,
        &1,
    );
}

#[test]
fn test_submit_evidence() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery]);

    let mid = client.create_milestone(
        &creator, &pvo_id,
        &make_string(&env, "M1"),
        &make_string(&env, ""),
        &1_000_000, &required, &1,
    );

    let eid = client.submit_evidence(
        &submitter, &pvo_id, &mid,
        &EvidenceType::DroneImagery,
        &make_string(&env, "hash123"),
        &make_string(&env, "drone flyover"),
    );

    assert_eq!(eid, 3);

    let milestone = client.get_milestone(&mid).unwrap();
    assert_eq!(milestone.status, MilestoneStatus::EvidenceSubmitted);
    assert_eq!(milestone.submitted_evidence.len(), 1);
}

#[test]
fn test_full_milestone_release_flow() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let engineer = Address::generate(&env);
    let submitter = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery, EvidenceType::GpsCoordinates]);

    let mid = client.create_milestone(
        &creator, &pvo_id,
        &make_string(&env, "M1"),
        &make_string(&env, ""),
        &2_000_000, &required, &2,
    );

    client.submit_evidence(&submitter, &pvo_id, &mid, &EvidenceType::DroneImagery, &make_string(&env, "h1"), &make_string(&env, ""));
    client.submit_evidence(&submitter, &pvo_id, &mid, &EvidenceType::GpsCoordinates, &make_string(&env, "h2"), &make_string(&env, ""));

    client.engineer_approve(&engineer, &mid);
    client.ai_validate(&mid, &true);
    client.compliance_check(&mid, &true);
    client.add_community_verification(&mid);
    client.add_community_verification(&mid);

    assert!(client.check_milestone_ready(&mid));

    let released = client.release_milestone(&mid);
    assert!(released);

    let milestone = client.get_milestone(&mid).unwrap();
    assert_eq!(milestone.status, MilestoneStatus::Released);
}

#[test]
fn test_milestone_not_ready_without_all_checks() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery]);

    let mid = client.create_milestone(
        &creator, &pvo_id,
        &make_string(&env, "M1"), &make_string(&env, ""),
        &1_000_000, &required, &1,
    );

    client.submit_evidence(&submitter, &pvo_id, &mid, &EvidenceType::DroneImagery, &make_string(&env, "h1"), &make_string(&env, ""));

    assert!(!client.check_milestone_ready(&mid));

    let released = client.release_milestone(&mid);
    assert!(!released);
}

#[test]
fn test_get_pvo_milestones() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery]);

    client.create_milestone(&creator, &pvo_id, &make_string(&env, "M1"), &make_string(&env, ""), &1_000_000, &required, &1);
    client.create_milestone(&creator, &pvo_id, &make_string(&env, "M2"), &make_string(&env, ""), &2_000_000, &required, &1);

    let milestones = client.get_pvo_milestones(&pvo_id);
    assert_eq!(milestones.len(), 2);
}

#[test]
fn test_get_pvo_count() {
    let (env, client) = setup();

    assert_eq!(client.get_pvo_count(), 0);

    create_test_pvo(&env, &client);
    assert_eq!(client.get_pvo_count(), 1);

    create_test_pvo(&env, &client);
    assert_eq!(client.get_pvo_count(), 2);
}

#[test]
fn test_get_pv_os_by_contractor() {
    let (env, client) = setup();

    let creator = Address::generate(&env);
    let agency = Address::generate(&env);
    let contractor = Address::generate(&env);
    let pm = Address::generate(&env);

    client.create_pvo(
        &creator, &make_string(&env, "Project A"), &make_string(&env, ""),
        &agency, &contractor, &pm,
        &make_string(&env, "DPWH"), &make_string(&env, "QC"),
        &5_000_000, &make_string(&env, "Budget"),
    );

    client.create_pvo(
        &creator, &make_string(&env, "Project B"), &make_string(&env, ""),
        &agency, &contractor, &pm,
        &make_string(&env, "DPWH"), &make_string(&env, "Manila"),
        &3_000_000, &make_string(&env, "Budget"),
    );

    let other_contractor = Address::generate(&env);
    client.create_pvo(
        &creator, &make_string(&env, "Project C"), &make_string(&env, ""),
        &agency, &other_contractor, &pm,
        &make_string(&env, "DPWH"), &make_string(&env, "Cebu"),
        &2_000_000, &make_string(&env, "Budget"),
    );

    let pvos = client.get_pv_os_by_contractor(&contractor);
    assert_eq!(pvos.len(), 2);
}

#[test]
fn test_community_verification_threshold() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let required = Vec::from_array(&env, [EvidenceType::DroneImagery]);

    let mid = client.create_milestone(
        &creator, &pvo_id,
        &make_string(&env, "M1"), &make_string(&env, ""),
        &1_000_000, &required, &3,
    );

    client.submit_evidence(&submitter, &pvo_id, &mid, &EvidenceType::DroneImagery, &make_string(&env, "h1"), &make_string(&env, ""));

    client.add_community_verification(&mid);
    assert_eq!(client.get_milestone(&mid).unwrap().community_confirmations, 1);
    assert_ne!(client.get_milestone(&mid).unwrap().status, MilestoneStatus::CommunityVerified);

    client.add_community_verification(&mid);
    client.add_community_verification(&mid);
    assert_eq!(client.get_milestone(&mid).unwrap().status, MilestoneStatus::CommunityVerified);
}

#[test]
#[should_panic(expected = "cannot submit evidence to completed milestone")]
fn test_submit_evidence_to_released_milestone() {
    let (env, client) = setup();
    let pvo_id = create_test_pvo(&env, &client);

    let creator = Address::generate(&env);
    let submitter = Address::generate(&env);
    let required = Vec::new(&env);

    let mid = client.create_milestone(
        &creator, &pvo_id,
        &make_string(&env, "M1"), &make_string(&env, ""),
        &1_000_000, &required, &0,
    );

    client.engineer_approve(&Address::generate(&env), &mid);
    client.ai_validate(&mid, &true);
    client.compliance_check(&mid, &true);
    assert!(client.release_milestone(&mid));

    client.submit_evidence(&submitter, &pvo_id, &mid, &EvidenceType::DroneImagery, &make_string(&env, "h1"), &make_string(&env, ""));
}
