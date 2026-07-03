#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn setup() -> (Env, ProcurementMarketClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ProcurementMarket, ());
    let client = ProcurementMarketClient::new(&env, &contract_id);
    client.initialize();
    (env, client)
}

#[test]
fn test_create_tender() {
    let (env, client) = setup();
    let agency = Address::generate(&env);

    let id = client.create_tender(
        &agency,
        &make_string(&env, "Road Paving Tender"),
        &make_string(&env, "10km road construction"),
        &10_000_000_i128,
        &1000,
    );

    let tender = client.get_tender(&id).unwrap();
    assert_eq!(tender.title, make_string(&env, "Road Paving Tender"));
    assert_eq!(tender.budget, 10_000_000_i128);
    assert_eq!(tender.status, TenderStatus::Open);
}

#[test]
fn test_submit_bid_and_award() {
    let (env, client) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    let tid = client.create_tender(&agency, &make_string(&env, "Bridge"), &make_string(&env, "Build"), &10_000_000_i128, &1000);

    // Contractor 1: good price, high quality, high reputation
    client.submit_bid(&c1, &tid, &9_000_000_i128, &90, &30, &80);
    // Contractor 2: lower price, lower quality
    client.submit_bid(&c2, &tid, &8_000_000_i128, &60, &45, &40);

    client.award_tender(&agency, &tid);

    let tender = client.get_tender(&tid).unwrap();
    assert_eq!(tender.status, TenderStatus::Awarded);
    assert!(tender.winner.is_some());
}

#[test]
fn test_get_bids() {
    let (env, client) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);

    let tid = client.create_tender(&agency, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_500_000_i128, &85, &20, &70);
    client.submit_bid(&c1, &tid, &4_800_000_i128, &90, &15, &60);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);
}

#[test]
#[should_panic(expected = "no bids to award")]
fn test_award_empty_tender() {
    let (env, client) = setup();
    let agency = Address::generate(&env);
    let tid = client.create_tender(&agency, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);
    client.award_tender(&agency, &tid);
}

#[test]
fn test_tender_count() {
    let (env, client) = setup();
    let agency = Address::generate(&env);
    assert_eq!(client.get_tender_count(), 0);
    client.create_tender(&agency, &make_string(&env, "T1"), &make_string(&env, "D"), &1_000_000_i128, &100);
    client.create_tender(&agency, &make_string(&env, "T2"), &make_string(&env, "D"), &2_000_000_i128, &200);
    assert_eq!(client.get_tender_count(), 2);
}
