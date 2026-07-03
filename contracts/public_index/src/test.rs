#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, PublicIndexClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PublicIndex, ());
    let client = PublicIndexClient::new(&env, &contract_id);
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
fn test_update_benchmark() {
    let (env, client) = setup();
    let caller = Address::generate(&env);

    client.update_department_benchmark(
        &caller,
        &make_string(&env, "DPWH"),
        &85,
        &15,
        &500_000_000_i128,
        &12,
        &80,
    );

    let benchmark = client.get_benchmark(&make_string(&env, "DPWH")).unwrap();
    assert_eq!(benchmark.avg_value_score, 85);
    assert_eq!(benchmark.pvo_count, 15);
    assert_eq!(benchmark.rank, 1);
}

#[test]
fn test_multiple_departments_ranked() {
    let (env, client) = setup();
    let caller = Address::generate(&env);

    client.update_department_benchmark(&caller, &make_string(&env, "DPWH"), &75, &10, &100_000_000_i128, &8, &70);
    client.update_department_benchmark(&caller, &make_string(&env, "DOH"), &90, &8, &80_000_000_i128, &7, &90);
    client.update_department_benchmark(&caller, &make_string(&env, "DepEd"), &65, &20, &200_000_000_i128, &15, &60);

    let doh = client.get_benchmark(&make_string(&env, "DOH")).unwrap();
    let dpwh = client.get_benchmark(&make_string(&env, "DPWH")).unwrap();
    let deped = client.get_benchmark(&make_string(&env, "DepEd")).unwrap();

    assert_eq!(doh.rank, 1);
    assert_eq!(dpwh.rank, 2);
    assert_eq!(deped.rank, 3);
}

#[test]
fn test_record_snapshot() {
    let (env, client) = setup();
    let caller = Address::generate(&env);

    client.update_department_benchmark(&caller, &make_string(&env, "DPWH"), &85, &10, &100_000_000_i128, &8, &80);

    let _id = client.record_national_snapshot(&caller);
    let snapshot = client.get_latest_snapshot().unwrap();
    assert_eq!(snapshot.total_pvos, 10);
    assert_eq!(snapshot.avg_value_score, 85);
    assert_eq!(snapshot.departments_ranked, 1);
}

#[test]
fn test_get_all_benchmarks() {
    let (env, client) = setup();
    let caller = Address::generate(&env);

    client.update_department_benchmark(&caller, &make_string(&env, "DPWH"), &80, &5, &50_000_000_i128, &4, &75);
    client.update_department_benchmark(&caller, &make_string(&env, "DOH"), &70, &3, &30_000_000_i128, &2, &60);

    let all = client.get_all_benchmarks();
    assert_eq!(all.len(), 2);
}

#[test]
fn test_department_count() {
    let (env, client) = setup();
    let caller = Address::generate(&env);

    assert_eq!(client.get_department_count(), 0);

    client.update_department_benchmark(&caller, &make_string(&env, "DPWH"), &80, &5, &50_000_000_i128, &4, &75);
    assert_eq!(client.get_department_count(), 1);

    client.update_department_benchmark(&caller, &make_string(&env, "DOH"), &70, &3, &30_000_000_i128, &2, &60);
    assert_eq!(client.get_department_count(), 2);
}
