#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, ComplianceEngineClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ComplianceEngine, ());
    let client = ComplianceEngineClient::new(&env, &contract_id);
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
fn test_report_violation() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let officer = Address::generate(&env);

    client.add_compliance_officer(&admin, &officer);

    let id = client.report_violation(
        &officer,
        &1,
        &ComplianceRule::BudgetDeviation,
        &make_string(&env, "Budget exceeded by 15%"),
        &75,
    );

    let violation = client.get_violation(&id).unwrap();
    assert_eq!(violation.pvo_id, 1);
    assert_eq!(violation.severity, 75);
    assert!(violation.auto_paused);
    assert!(!violation.resolved);
}

#[test]
fn test_resolve_violation() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let officer = Address::generate(&env);

    client.add_compliance_officer(&admin, &officer);

    let id = client.report_violation(&officer, &1, &ComplianceRule::SafetyViolation, &make_string(&env, "No safety gear"), &40);
    client.resolve_violation(&officer, &id);

    let violation = client.get_violation(&id).unwrap();
    assert!(violation.resolved);
}

#[test]
fn test_is_pvo_compliant() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let officer = Address::generate(&env);

    client.add_compliance_officer(&admin, &officer);

    assert!(client.is_pvo_compliant(&1));

    client.report_violation(&officer, &1, &ComplianceRule::ProcurementLaw, &make_string(&env, "No bidding"), &80);
    assert!(!client.is_pvo_compliant(&1));
}

#[test]
fn test_get_active_violations() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let officer = Address::generate(&env);

    client.add_compliance_officer(&admin, &officer);

    let id1 = client.report_violation(&officer, &1, &ComplianceRule::BudgetDeviation, &make_string(&env, "v1"), &50);
    let _id2 = client.report_violation(&officer, &2, &ComplianceRule::EnvironmentalRegulation, &make_string(&env, "v2"), &30);

    client.resolve_violation(&officer, &id1);

    let active = client.get_active_violations();
    assert_eq!(active.len(), 1);
}

#[test]
#[should_panic(expected = "only compliance officers")]
fn test_non_officer_cannot_report() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let officer = Address::generate(&env);
    let rando = Address::generate(&env);

    client.add_compliance_officer(&admin, &officer);

    client.report_violation(&rando, &1, &ComplianceRule::SafetyViolation, &make_string(&env, "x"), &10);
}

#[test]
fn test_auto_pause_threshold() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let officer = Address::generate(&env);

    client.add_compliance_officer(&admin, &officer);

    let low = client.report_violation(&officer, &1, &ComplianceRule::LaborCompliance, &make_string(&env, "Minor"), &69);
    let high = client.report_violation(&officer, &1, &ComplianceRule::COAregulation, &make_string(&env, "Serious"), &70);

    assert!(!client.get_violation(&low).unwrap().auto_paused);
    assert!(client.get_violation(&high).unwrap().auto_paused);
}
