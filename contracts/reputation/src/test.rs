#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, ReputationLedgerClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReputationLedger, ());
    let client = ReputationLedgerClient::new(&env, &contract_id);
    client.initialize();
    (env, client)
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
fn test_register_entity() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);

    client.register_entity(&contractor, &EntityType::Contractor);

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.entity_type, EntityType::Contractor);
    assert_eq!(record.reputation_score, 100);
    assert_eq!(record.completed_projects, 0);
}

#[test]
#[should_panic(expected = "entity already registered")]
fn test_double_register() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);

    client.register_entity(&contractor, &EntityType::Contractor);
    client.register_entity(&contractor, &EntityType::Contractor);
}

#[test]
fn test_record_completion_on_time_within_budget() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    client.record_completion(&caller, &contractor, &90, &true, &true);

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.completed_projects, 1);
    assert_eq!(record.delayed_projects, 0);
    assert_eq!(record.average_value_score, 90);
    assert_eq!(record.success_rate, 100);
}

#[test]
fn test_record_completion_delayed() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    client.record_completion(&caller, &contractor, &60, &false, &true);

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.delayed_projects, 1);
    assert_eq!(record.success_rate, 0);
    assert!(record.reputation_score < 100);
}

#[test]
fn test_record_completion_budget_overrun() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    client.record_completion(&caller, &contractor, &70, &true, &false);

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.budget_overruns, 1);
    assert!(record.reputation_score < 100);
}

#[test]
fn test_multiple_completions_average() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    client.record_completion(&caller, &contractor, &80, &true, &true);
    client.record_completion(&caller, &contractor, &90, &true, &true);

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.completed_projects, 2);
    assert_eq!(record.average_value_score, 85);
}

#[test]
fn test_audit_finding_reduces_score() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    let before = client.get_reputation(&contractor).unwrap().reputation_score;
    client.record_audit_finding(&caller, &contractor, &3);
    let after = client.get_reputation(&contractor).unwrap().reputation_score;

    assert_eq!(after, before.saturating_sub(15));
}

#[test]
fn test_safety_violation() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    let before = client.get_reputation(&contractor).unwrap().reputation_score;
    client.record_safety_violation(&caller, &contractor, &2);
    let after = client.get_reputation(&contractor).unwrap().reputation_score;

    assert_eq!(after, before.saturating_sub(20));
}

#[test]
fn test_file_complaint() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    let complainant = Address::generate(&env);

    client.register_entity(&contractor, &EntityType::Contractor);

    let id = client.file_complaint(
        &complainant, &contractor,
        &make_string(&env, "poor quality"),
        &make_string(&env, "cracks in pavement"),
        &5,
    );

    let complaint = client.get_complaint(&id).unwrap();
    assert_eq!(complaint.entity, contractor);
    assert_eq!(complaint.complainant, complainant);
    assert!(!complaint.verified);

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.community_complaints, 1);
    assert!(record.reputation_score < 100);
}

#[test]
fn test_verify_complaint() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    let complainant = Address::generate(&env);

    client.register_entity(&contractor, &EntityType::Contractor);

    let id = client.file_complaint(
        &complainant, &contractor,
        &make_string(&env, "delay"),
        &make_string(&env, "6 months late"),
        &3,
    );

    let caller = Address::generate(&env);
    client.verify_complaint(&caller, &id);

    let complaint = client.get_complaint(&id).unwrap();
    assert!(complaint.verified);
}

#[test]
fn test_get_complaints_by_entity() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    client.register_entity(&contractor, &EntityType::Contractor);

    client.file_complaint(&c1, &contractor, &make_string(&env, "a"), &make_string(&env, "b"), &1);
    client.file_complaint(&c2, &contractor, &make_string(&env, "c"), &make_string(&env, "d"), &2);

    let complaints = client.get_complaints_by_entity(&contractor);
    assert_eq!(complaints.len(), 2);
}

#[test]
fn test_get_entities_by_reputation() {
    let (env, client) = setup();
    let good_contractor = Address::generate(&env);
    let bad_contractor = Address::generate(&env);

    client.register_entity(&good_contractor, &EntityType::Contractor);
    client.register_entity(&bad_contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    client.record_completion(&caller, &good_contractor, &95, &true, &true);
    client.record_safety_violation(&caller, &bad_contractor, &5);

    let reputable = client.get_entities_by_reputation(&EntityType::Contractor, &50);
    assert!(reputable.len() >= 1);
}

#[test]
fn test_get_entity_count() {
    let (env, client) = setup();

    assert_eq!(client.get_entity_count(), 0);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    client.register_entity(&c1, &EntityType::Contractor);
    assert_eq!(client.get_entity_count(), 1);

    client.register_entity(&c2, &EntityType::Supplier);
    assert_eq!(client.get_entity_count(), 2);
}

#[test]
fn test_multiple_entity_types() {
    let (env, client) = setup();

    let contractor = Address::generate(&env);
    let engineer = Address::generate(&env);
    let supplier = Address::generate(&env);

    client.register_entity(&contractor, &EntityType::Contractor);
    client.register_entity(&engineer, &EntityType::Engineer);
    client.register_entity(&supplier, &EntityType::Supplier);

    assert_eq!(client.get_entity_count(), 3);

    let contractors = client.get_entities_by_reputation(&EntityType::Contractor, &0);
    assert_eq!(contractors.len(), 1);
}

#[test]
fn test_reputation_score_floor_at_zero() {
    let (env, client) = setup();
    let contractor = Address::generate(&env);
    client.register_entity(&contractor, &EntityType::Contractor);

    let caller = Address::generate(&env);
    for _ in 0..10 {
        client.record_safety_violation(&caller, &contractor, &10);
    }

    let record = client.get_reputation(&contractor).unwrap();
    assert_eq!(record.reputation_score, 0);
}
