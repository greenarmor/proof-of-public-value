#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, CommunityOracleClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(CommunityOracle, ());
    let client = CommunityOracleClient::new(&env, &contract_id);
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
fn test_submit_report() {
    let (env, client) = setup();
    let citizen = Address::generate(&env);

    let id = client.submit_report(
        &citizen, &1, &1,
        &ReportType::GpsPhoto,
        &make_string(&env, "hash1"),
        &143000000_i128, &1210000000_i128,
    );

    let report = client.get_report(&id).unwrap();
    assert_eq!(report.pvo_id, 1);
    assert_eq!(report.report_type, ReportType::GpsPhoto);
    assert!(!report.verified);
}

#[test]
fn test_citizen_reputation_tracking() {
    let (env, client) = setup();
    let citizen = Address::generate(&env);

    client.submit_report(
        &citizen, &1, &1, &ReportType::GpsPhoto,
        &make_string(&env, "h1"), &1, &2,
    );

    let rep = client.get_citizen_reputation(&citizen).unwrap();
    assert_eq!(rep.total_reports, 1);
    assert_eq!(rep.verified_reports, 0);
}

#[test]
fn test_verify_report() {
    let (env, client) = setup();
    let citizen = Address::generate(&env);

    let id = client.submit_report(
        &citizen, &1, &1, &ReportType::QualityReport,
        &make_string(&env, "h1"), &1, &2,
    );

    let verifier = Address::generate(&env);
    client.verify_report(&verifier, &id, &20);

    let report = client.get_report(&id).unwrap();
    assert!(report.verified);

    let rep = client.get_citizen_reputation(&citizen).unwrap();
    assert_eq!(rep.verified_reports, 1);
    assert_eq!(rep.confidence_rating, 70);
}

#[test]
fn test_calculate_confidence_no_reports() {
    let (env, client) = setup();
    let caller = Address::generate(&env);

    let score = client.calculate_confidence(&caller, &1, &1);
    assert_eq!(score, 0);
}

#[test]
fn test_calculate_confidence_multiple_reports() {
    let (env, client) = setup();
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    let r1 = client.submit_report(&c1, &1, &1, &ReportType::CompletionVerification, &make_string(&env, "h1"), &1, &2);
    let _r2 = client.submit_report(&c2, &1, &1, &ReportType::CompletionVerification, &make_string(&env, "h2"), &1, &2);
    let _r3 = client.submit_report(&c3, &1, &1, &ReportType::CompletionVerification, &make_string(&env, "h3"), &1, &2);

    let verifier = Address::generate(&env);
    client.verify_report(&verifier, &r1, &30);

    let caller = Address::generate(&env);
    let score = client.calculate_confidence(&caller, &1, &1);
    assert!(score > 0);
}

#[test]
fn test_get_reports_by_pvo() {
    let (env, client) = setup();
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    client.submit_report(&c1, &1, &1, &ReportType::GpsPhoto, &make_string(&env, "h1"), &1, &2);
    client.submit_report(&c2, &1, &1, &ReportType::GpsVideo, &make_string(&env, "h2"), &1, &2);
    client.submit_report(&c1, &2, &1, &ReportType::FloodReport, &make_string(&env, "h3"), &1, &2);

    let pvo1_reports = client.get_reports_by_pvo(&1);
    assert_eq!(pvo1_reports.len(), 2);
}

#[test]
fn test_get_report_count() {
    let (env, client) = setup();
    let c1 = Address::generate(&env);

    assert_eq!(client.get_report_count(), 0);

    client.submit_report(&c1, &1, &1, &ReportType::GpsPhoto, &make_string(&env, "h1"), &1, &2);
    assert_eq!(client.get_report_count(), 1);
}

#[test]
fn test_multiple_citizens_same_milestone() {
    let (env, client) = setup();
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    client.submit_report(&c1, &1, &1, &ReportType::CompletionVerification, &make_string(&env, "h1"), &1, &2);
    client.submit_report(&c2, &1, &1, &ReportType::CompletionVerification, &make_string(&env, "h2"), &1, &2);
    client.submit_report(&c3, &1, &1, &ReportType::CompletionVerification, &make_string(&env, "h3"), &1, &2);

    let reports = client.get_reports_by_pvo(&1);
    assert_eq!(reports.len(), 3);
}

#[test]
fn test_citizen_confidence_grows() {
    let (env, client) = setup();
    let citizen = Address::generate(&env);

    let id1 = client.submit_report(&citizen, &1, &1, &ReportType::GpsPhoto, &make_string(&env, "h1"), &1, &2);
    let verifier = Address::generate(&env);
    client.verify_report(&verifier, &id1, &20);

    let id2 = client.submit_report(&citizen, &2, &1, &ReportType::GpsPhoto, &make_string(&env, "h2"), &1, &2);
    client.verify_report(&verifier, &id2, &20);

    let rep = client.get_citizen_reputation(&citizen).unwrap();
    assert_eq!(rep.total_reports, 2);
    assert_eq!(rep.verified_reports, 2);
    assert!(rep.confidence_rating >= 80);
}

#[test]
fn test_all_report_types() {
    let (env, client) = setup();
    let citizen = Address::generate(&env);

    let types = [
        ReportType::GpsPhoto,
        ReportType::GpsVideo,
        ReportType::FloodReport,
        ReportType::CompletionVerification,
        ReportType::QualityReport,
        ReportType::DamageReport,
        ReportType::UsageReport,
    ];

    for (i, rt) in types.iter().enumerate() {
        client.submit_report(
            &citizen, &1, &(i as u32 + 1), rt,
            &make_string(&env, "h"), &1, &2,
        );
    }

    assert_eq!(client.get_report_count(), 7);
}
