#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, AuditTrailClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AuditTrail, ());
    let client = AuditTrailClient::new(&env, &contract_id);
    client.initialize();
    (env, client)
}

fn record_test_decision(env: &Env, client: &AuditTrailClient, actor: &Address, pvo_id: u32) -> u32 {
    client.record_decision(
        actor, &pvo_id,
        &DecisionCategory::Approval,
        &make_string(env, "approve milestone 1"),
        &make_string(env, "evidence verified"),
        &make_string(env, "doc_hash_123"),
        &make_string(env, "low risk"),
        &15,
        &make_string(env, "passed"),
        &make_string(env, "sig_hash_456"),
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
fn test_record_decision() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    let id = record_test_decision(&env, &client, &actor, 1);

    let entry = client.get_entry(&id).unwrap();
    assert_eq!(entry.pvo_id, 1);
    assert_eq!(entry.category, DecisionCategory::Approval);
    assert_eq!(entry.actor, actor);
    assert_eq!(entry.risk_score, 15);
}

#[test]
fn test_record_decision_with_role() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    let id = client.record_decision_with_role(
        &actor,
        &make_string(&env, "Commission on Audit"),
        &1,
        &DecisionCategory::ComplianceCheck,
        &make_string(&env, "compliance verified"),
        &make_string(&env, "all requirements met"),
        &make_string(&env, "hash1"),
        &make_string(&env, "no issues"),
        &5,
        &make_string(&env, "passed"),
        &make_string(&env, "sig1"),
    );

    let entry = client.get_entry(&id).unwrap();
    assert_eq!(entry.actor_role, make_string(&env, "Commission on Audit"));
}

#[test]
fn test_get_pvo_audit_history() {
    let (env, client) = setup();
    let actor1 = Address::generate(&env);
    let actor2 = Address::generate(&env);

    record_test_decision(&env, &client, &actor1, 1);
    record_test_decision(&env, &client, &actor2, 1);
    record_test_decision(&env, &client, &actor1, 2);

    let pvo1_history = client.get_pvo_audit_history(&1);
    assert_eq!(pvo1_history.len(), 2);

    let pvo2_history = client.get_pvo_audit_history(&2);
    assert_eq!(pvo2_history.len(), 1);
}

#[test]
fn test_get_entries_by_actor() {
    let (env, client) = setup();
    let actor1 = Address::generate(&env);
    let actor2 = Address::generate(&env);

    record_test_decision(&env, &client, &actor1, 1);
    record_test_decision(&env, &client, &actor1, 1);
    record_test_decision(&env, &client, &actor2, 1);

    let actor1_entries = client.get_entries_by_actor(&actor1);
    assert_eq!(actor1_entries.len(), 2);

    let actor2_entries = client.get_entries_by_actor(&actor2);
    assert_eq!(actor2_entries.len(), 1);
}

#[test]
fn test_get_entries_by_category() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    client.record_decision(
        &actor, &1, &DecisionCategory::Approval,
        &make_string(&env, "a"), &make_string(&env, "b"),
        &make_string(&env, "c"), &make_string(&env, "d"),
        &10, &make_string(&env, "e"), &make_string(&env, "f"),
    );

    client.record_decision(
        &actor, &1, &DecisionCategory::Payment,
        &make_string(&env, "a"), &make_string(&env, "b"),
        &make_string(&env, "c"), &make_string(&env, "d"),
        &20, &make_string(&env, "e"), &make_string(&env, "f"),
    );

    client.record_decision(
        &actor, &1, &DecisionCategory::Approval,
        &make_string(&env, "a"), &make_string(&env, "b"),
        &make_string(&env, "c"), &make_string(&env, "d"),
        &30, &make_string(&env, "e"), &make_string(&env, "f"),
    );

    let approvals = client.get_entries_by_category(&DecisionCategory::Approval);
    assert_eq!(approvals.len(), 2);

    let payments = client.get_entries_by_category(&DecisionCategory::Payment);
    assert_eq!(payments.len(), 1);
}

#[test]
fn test_get_high_risk_entries() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    client.record_decision(
        &actor, &1, &DecisionCategory::AIRiskAssessment,
        &make_string(&env, "a"), &make_string(&env, "b"),
        &make_string(&env, "c"), &make_string(&env, "d"),
        &25, &make_string(&env, "e"), &make_string(&env, "f"),
    );

    client.record_decision(
        &actor, &1, &DecisionCategory::AIRiskAssessment,
        &make_string(&env, "a"), &make_string(&env, "b"),
        &make_string(&env, "c"), &make_string(&env, "d"),
        &75, &make_string(&env, "e"), &make_string(&env, "f"),
    );

    let high_risk = client.get_high_risk_entries(&50);
    assert_eq!(high_risk.len(), 1);
    assert_eq!(high_risk.get(0).unwrap().risk_score, 75);
}

#[test]
fn test_get_entry_count() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    assert_eq!(client.get_entry_count(), 0);

    record_test_decision(&env, &client, &actor, 1);
    assert_eq!(client.get_entry_count(), 1);

    record_test_decision(&env, &client, &actor, 1);
    assert_eq!(client.get_entry_count(), 2);
}

#[test]
fn test_get_pvo_entry_count() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    assert_eq!(client.get_pvo_entry_count(&1), 0);

    record_test_decision(&env, &client, &actor, 1);
    record_test_decision(&env, &client, &actor, 1);
    record_test_decision(&env, &client, &actor, 2);

    assert_eq!(client.get_pvo_entry_count(&1), 2);
    assert_eq!(client.get_pvo_entry_count(&2), 1);
}

#[test]
fn test_audit_entry_immutability() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    let id = record_test_decision(&env, &client, &actor, 1);
    let original = client.get_entry(&id).unwrap();

    let entry2 = client.get_entry(&id).unwrap();
    assert_eq!(original, entry2);
}

#[test]
fn test_all_decision_categories() {
    let (env, client) = setup();
    let actor = Address::generate(&env);

    let categories = [
        DecisionCategory::Approval,
        DecisionCategory::Payment,
        DecisionCategory::EvidenceReview,
        DecisionCategory::ComplianceCheck,
        DecisionCategory::AIRiskAssessment,
        DecisionCategory::ProcurementAward,
        DecisionCategory::ContractModification,
        DecisionCategory::DisputeResolution,
        DecisionCategory::MilestoneRelease,
        DecisionCategory::RoleChange,
    ];

    for cat in categories.iter() {
        client.record_decision(
            &actor, &1, cat,
            &make_string(&env, "a"), &make_string(&env, "b"),
            &make_string(&env, "c"), &make_string(&env, "d"),
            &10, &make_string(&env, "e"), &make_string(&env, "f"),
        );
    }

    assert_eq!(client.get_entry_count(), 10);
}
