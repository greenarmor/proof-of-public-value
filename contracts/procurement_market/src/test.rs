#![cfg(test)]

use super::{ProcurementMarket, ProcurementMarketClient, TenderStatus};
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};
use reputation::{ReputationLedger, ReputationLedgerClient, EntityType};

fn make_string(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

fn register_reputation(env: &Env) -> Address {
    let reputation_id = env.register(ReputationLedger, ());
    let reputation_client = reputation::ReputationLedgerClient::new(env, &reputation_id);
    reputation_client.initialize();
    reputation_id
}

fn register_entity(env: &Env, reputation_id: &Address, entity: &Address, entity_type: EntityType) {
    let reputation_client = reputation::ReputationLedgerClient::new(env, reputation_id);
    reputation_client.register_entity(entity, &entity_type);
}

fn setup() -> (Env, ProcurementMarketClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let reputation_id = register_reputation(&env);

    let contract_id = env.register(ProcurementMarket, ());
    let client = ProcurementMarketClient::new(&env, &contract_id);
    client.initialize(&reputation_id);
    (env, client, reputation_id)
}

#[test]
fn test_create_tender() {
    let (env, client, _rep_id) = setup();
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
    let (env, client, reputation_id) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    // Register contractors in reputation so they get scores
    register_entity(&env, &reputation_id, &c1, EntityType::Contractor);
    register_entity(&env, &reputation_id, &c2, EntityType::Contractor);

    let tid = client.create_tender(&agency, &make_string(&env, "Bridge"), &make_string(&env, "Build"), &10_000_000_i128, &1000);

    // Contractor 1: good price, high quality
    client.submit_bid(&c1, &tid, &9_000_000_i128, &90, &30);
    // Contractor 2: lower price, lower quality
    client.submit_bid(&c2, &tid, &8_000_000_i128, &60, &45);

    client.award_tender(&agency, &tid);

    let tender = client.get_tender(&tid).unwrap();
    assert_eq!(tender.status, TenderStatus::Awarded);
    assert!(tender.winner.is_some());

    // Verify reputation scores are stored in bids
    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);
    // Newly registered contractors get a 100 reputation score
    assert_eq!(bids.get(0).unwrap().reputation_score, 100);
}

#[test]
fn test_get_bids() {
    let (env, client, reputation_id) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);

    register_entity(&env, &reputation_id, &c1, EntityType::Contractor);

    let tid = client.create_tender(&agency, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_500_000_i128, &85, &20);
    client.submit_bid(&c1, &tid, &4_800_000_i128, &90, &15);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);
}

#[test]
fn test_bid_with_no_reputation() {
    let (env, client, _rep_id) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);

    // Don't register c1 in reputation — they get score 0
    let tid = client.create_tender(&agency, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_000_000_i128, &70, &30);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 1);
    assert_eq!(bids.get(0).unwrap().reputation_score, 0);
}

#[test]
#[should_panic(expected = "no bids to award")]
fn test_award_empty_tender() {
    let (env, client, _rep_id) = setup();
    let agency = Address::generate(&env);
    let tid = client.create_tender(&agency, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);
    client.award_tender(&agency, &tid);
}

#[test]
fn test_tender_count() {
    let (env, client, _rep_id) = setup();
    let agency = Address::generate(&env);
    assert_eq!(client.get_tender_count(), 0);
    client.create_tender(&agency, &make_string(&env, "T1"), &make_string(&env, "D"), &1_000_000_i128, &100);
    client.create_tender(&agency, &make_string(&env, "T2"), &make_string(&env, "D"), &2_000_000_i128, &200);
    assert_eq!(client.get_tender_count(), 2);
}

#[test]
fn test_reputation_affects_final_score() {
    let (env, client, reputation_id) = setup();
    let agency = Address::generate(&env);
    let good = Address::generate(&env);
    let bad = Address::generate(&env);

    register_entity(&env, &reputation_id, &good, EntityType::Contractor);
    register_entity(&env, &reputation_id, &bad, EntityType::Contractor);

    // Give "bad" contractor a penalty
    let reputation_client = reputation::ReputationLedgerClient::new(&env, &reputation_id);
    reputation_client.record_audit_finding(&agency, &bad, &5);

    let tid = client.create_tender(&agency, &make_string(&env, "Test"), &make_string(&env, "Desc"), &10_000_000_i128, &1000);

    client.submit_bid(&good, &tid, &9_000_000_i128, &90, &30);
    client.submit_bid(&bad, &tid, &9_000_000_i128, &90, &30);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);

    let good_score = bids.iter().find(|b| b.contractor == good).unwrap().final_score;
    let bad_score = bids.iter().find(|b| b.contractor == bad).unwrap().final_score;

    // Bad contractor's final score should be LOWER due to audit finding penalty
    assert!(good_score > bad_score);
}
