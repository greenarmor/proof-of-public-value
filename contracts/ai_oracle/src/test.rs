#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String, Vec};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, AIOracleClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AIOracle, ());
    let client = AIOracleClient::new(&env, &contract_id);
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
fn test_add_ai_auditor() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);
}

#[test]
#[should_panic(expected = "only AI auditors can submit")]
fn test_non_auditor_cannot_submit() {
    let (env, client) = setup();
    let auditor = Address::generate(&env);

    client.submit_fraud_detection(
        &auditor,
        &1,
        &50,
        &Vec::from_array(&env, [FraudIndicator::DuplicateInvoice]),
        &85,
        &make_string(&env, "hash123"),
    );
}

#[test]
fn test_submit_fraud_detection() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    let id = client.submit_fraud_detection(
        &auditor,
        &1,
        &75,
        &Vec::from_array(&env, [FraudIndicator::GhostProject, FraudIndicator::CollusionPattern]),
        &90,
        &make_string(&env, "evidence_hash_abc"),
    );

    let result = client.get_fraud_detection(&id).unwrap();
    assert_eq!(result.pvo_id, 1);
    assert_eq!(result.risk_score, 75);
    assert_eq!(result.confidence, 90);
    assert_eq!(result.indicators.len(), 2);
}

#[test]
fn test_submit_risk_prediction() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);
    let contractor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    let _id = client.submit_risk_prediction(
        &auditor,
        &contractor,
        &40,
        &25,
        &1,
        &80,
    );

    let latest = client.get_latest_risk_prediction(&contractor).unwrap();
    assert_eq!(latest.delay_probability, 40);
    assert_eq!(latest.overrun_probability, 25);
    assert_eq!(latest.risk_category, 1);
}

#[test]
fn test_submit_image_verification() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    let id = client.submit_image_verification(
        &auditor,
        &3,
        &65,
        &95,
        &make_string(&env, "65% complete, drone confirms progress"),
    );

    let result = client.get_image_verification(&id).unwrap();
    assert_eq!(result.evidence_id, 3);
    assert_eq!(result.progress_percent, 65);
    assert_eq!(result.authenticity_score, 95);
}

#[test]
fn test_digital_twin() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    client.update_digital_twin(
        &auditor,
        &1,
        &9500000,
        &110,
        &105,
        &false,
    );

    let twin = client.get_digital_twin(&1).unwrap();
    assert_eq!(twin.expected_cost, 9500000);
    assert_eq!(twin.material_cost_index, 110);
    assert!(!twin.deviation_alert);
}

#[test]
fn test_get_fraud_by_pvo() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    client.submit_fraud_detection(
        &auditor, &1, &30,
        &Vec::from_array(&env, [FraudIndicator::AbnormalBudgetGrowth]),
        &70,
        &make_string(&env, "h1"),
    );
    client.submit_fraud_detection(
        &auditor, &1, &60,
        &Vec::from_array(&env, [FraudIndicator::DuplicateInvoice]),
        &80,
        &make_string(&env, "h2"),
    );

    let results = client.get_fraud_by_pvo(&1);
    assert_eq!(results.len(), 2);
}

#[test]
fn test_fraud_count() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    assert_eq!(client.get_fraud_count(), 0);

    client.submit_fraud_detection(
        &auditor, &1, &10,
        &Vec::from_array(&env, [FraudIndicator::ShellCompanyRisk]),
        &50,
        &make_string(&env, "h"),
    );

    assert_eq!(client.get_fraud_count(), 1);
}

#[test]
fn test_remove_auditor() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);
    client.remove_ai_auditor(&admin, &auditor);
}

#[test]
#[should_panic(expected = "only AI auditors can submit")]
fn test_removed_auditor_cannot_submit() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);
    client.remove_ai_auditor(&admin, &auditor);

    client.submit_fraud_detection(
        &auditor, &1, &50,
        &Vec::from_array(&env, []),
        &50,
        &make_string(&env, "h"),
    );
}

#[test]
fn test_risk_score_clamped() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    let id = client.submit_fraud_detection(
        &auditor,
        &1,
        &150,  // should clamp to 100
        &Vec::from_array(&env, []),
        &200,  // should clamp to 100
        &make_string(&env, "h"),
    );

    let result = client.get_fraud_detection(&id).unwrap();
    assert_eq!(result.risk_score, 100);
    assert_eq!(result.confidence, 100);
}

#[test]
fn test_submit_geo_risk() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    client.submit_geo_risk(
        &auditor,
        &1,
        &make_string(&env, "Quezon City"),
        &60,
        &30,
        &15,
    );

    let risk = client.get_geo_risk(&1).unwrap();
    assert_eq!(risk.flood_risk, 60);
    assert_eq!(risk.seismic_risk, 30);
    assert_eq!(risk.landslide_risk, 15);
    assert_eq!(risk.region, make_string(&env, "Quezon City"));
    assert!(risk.overall_risk_score > 0);
}

#[test]
fn test_submit_gps_validation_within_range() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    // Expected: 14.599512, 120.984220 — Reported: 14.599520, 120.984230 (~10m apart)
    let id = client.submit_gps_validation(
        &auditor,
        &3,
        &14_599512_i128,
        &120_984220_i128,
        &14_599520_i128,
        &120_984230_i128,
        &1000,
    );

    let validation = client.get_gps_validation(&id).unwrap();
    assert_eq!(validation.evidence_id, 3);
    assert!(validation.within_range);
}

#[test]
fn test_submit_gps_validation_out_of_range() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    let id = client.submit_gps_validation(
        &auditor,
        &4,
        &14_599512_i128,
        &120_984220_i128,
        &15_000000_i128,
        &121_500000_i128,
        &100,
    );

    let validation = client.get_gps_validation(&id).unwrap();
    assert!(!validation.within_range);
}

#[test]
fn test_geo_risk_overwrite() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let auditor = Address::generate(&env);

    client.add_ai_auditor(&admin, &auditor);

    client.submit_geo_risk(
        &auditor, &1, &make_string(&env, "Manila"),
        &80, &50, &40,
    );

    assert_eq!(client.get_geo_risk(&1).unwrap().flood_risk, 80);

    client.submit_geo_risk(
        &auditor, &1, &make_string(&env, "Manila Bay"),
        &40, &20, &10,
    );

    assert_eq!(client.get_geo_risk(&1).unwrap().flood_risk, 40);
}
