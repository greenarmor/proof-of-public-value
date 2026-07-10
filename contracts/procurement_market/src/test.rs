#![cfg(test)]

use super::{ProcurementMarket, ProcurementMarketClient, TenderStatus};
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};
use reputation::{ReputationLedger, ReputationLedgerClient, EntityType};
use access_control::{AccessControl, AccessControlClient, Role};

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

fn register_access_control(env: &Env, admin: &Address) -> Address {
    let ac_id = env.register(AccessControl, ());
    let ac_client = AccessControlClient::new(env, &ac_id);
    ac_client.initialize(admin);
    ac_id
}

fn assign_role(env: &Env, ac_id: &Address, admin: &Address, address: &Address, role: &Role) {
    let ac_client = AccessControlClient::new(env, ac_id);
    ac_client.assign_role(admin, address, role);
}

fn setup() -> (Env, ProcurementMarketClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let reputation_id = register_reputation(&env);
    let admin = Address::generate(&env);
    let ac_id = register_access_control(&env, &admin);

    let contract_id = env.register(ProcurementMarket, ());
    let client = ProcurementMarketClient::new(&env, &contract_id);
    let dummy = Address::generate(&env);
    client.initialize(&reputation_id, &dummy, &ac_id, &admin);
    (env, client, reputation_id, ac_id, admin)
}

#[test]
fn test_create_tender() {
    let (env, client, _rep_id, _ac_id, _admin) = setup();
    let agency = Address::generate(&env);

    let id = client.create_tender(
        &agency,
        &0u32,
        &0u32,
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
    let (env, client, reputation_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    register_entity(&env, &reputation_id, &c1, EntityType::Contractor);
    register_entity(&env, &reputation_id, &c2, EntityType::Contractor);
    assign_role(&env, &ac_id, &admin, &c1, &Role::Contractor);
    assign_role(&env, &ac_id, &admin, &c2, &Role::Contractor);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "Bridge"), &make_string(&env, "Build"), &10_000_000_i128, &1000);

    client.submit_bid(&c1, &tid, &9_000_000_i128, &90, &30);
    client.submit_bid(&c2, &tid, &8_000_000_i128, &60, &45);

    client.award_tender(&agency, &tid);

    let tender = client.get_tender(&tid).unwrap();
    assert_eq!(tender.status, TenderStatus::Awarded);
    assert!(tender.winner.is_some());

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);
    assert_eq!(bids.get(0).unwrap().reputation_score, 100);
}

#[test]
fn test_get_bids() {
    let (env, client, reputation_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);

    register_entity(&env, &reputation_id, &c1, EntityType::Contractor);
    register_entity(&env, &reputation_id, &c2, EntityType::Contractor);
    assign_role(&env, &ac_id, &admin, &c1, &Role::Contractor);
    assign_role(&env, &ac_id, &admin, &c2, &Role::Contractor);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_500_000_i128, &85, &20);
    client.submit_bid(&c2, &tid, &4_800_000_i128, &90, &15);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);
}

#[test]
fn test_bid_with_no_reputation() {
    let (env, client, _rep_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);

    assign_role(&env, &ac_id, &admin, &c1, &Role::Contractor);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_000_000_i128, &70, &30);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 1);
    assert_eq!(bids.get(0).unwrap().reputation_score, 0);
}

#[test]
fn test_supplier_can_bid() {
    let (env, client, _rep_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let s1 = Address::generate(&env);

    assign_role(&env, &ac_id, &admin, &s1, &Role::Supplier);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&s1, &tid, &4_000_000_i128, &70, &30);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 1);
}

#[test]
#[should_panic(expected = "only contractors and suppliers can submit bids")]
fn test_bid_rejected_without_role() {
    let (env, client, _rep_id, _ac_id, _admin) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_000_000_i128, &70, &30);
}

#[test]
#[should_panic(expected = "only contractors and suppliers can submit bids")]
fn test_bid_rejected_wrong_role() {
    let (env, client, _rep_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let funder = Address::generate(&env);

    assign_role(&env, &ac_id, &admin, &funder, &Role::FundingAgency);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&funder, &tid, &4_000_000_i128, &70, &30);
}

#[test]
#[should_panic(expected = "contractor has already submitted a bid")]
fn test_bid_duplicate_rejected() {
    let (env, client, reputation_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let contractor = Address::generate(&env);

    assign_role(&env, &ac_id, &admin, &contractor, &Role::Contractor);
    register_entity(&env, &reputation_id, &contractor, EntityType::Contractor);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    // First bid succeeds
    client.submit_bid(&contractor, &tid, &4_000_000_i128, &70, &30);

    // Second bid from same contractor should panic
    client.submit_bid(&contractor, &tid, &3_500_000_i128, &80, &25);
}

#[test]
#[should_panic(expected = "insufficient bids: requires at least 1")]
fn test_award_empty_tender() {
    let (env, client, _rep_id, _ac_id, _admin) = setup();
    let agency = Address::generate(&env);
    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);
    client.award_tender(&agency, &tid);
}

#[test]
#[should_panic(expected = "insufficient bids: requires at least 2")]
fn test_award_below_min_bids() {
    let (env, client, reputation_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let c1 = Address::generate(&env);

    register_entity(&env, &reputation_id, &c1, EntityType::Contractor);
    assign_role(&env, &ac_id, &admin, &c1, &Role::Contractor);

    client.set_min_bids(&admin, &2u32);
    assert_eq!(client.get_min_bids(), 2);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T"), &make_string(&env, "D"), &5_000_000_i128, &500);

    client.submit_bid(&c1, &tid, &4_000_000_i128, &70, &30);
    client.award_tender(&agency, &tid);
}

#[test]
fn test_set_and_get_min_bids() {
    let (_env, client, _rep_id, _ac_id, admin) = setup();
    assert_eq!(client.get_min_bids(), 1);
    client.set_min_bids(&admin, &3u32);
    assert_eq!(client.get_min_bids(), 3);
}

#[test]
#[should_panic(expected = "only admin can set min bids")]
fn test_set_min_bids_non_admin() {
    let (env, client, _rep_id, _ac_id, _admin) = setup();
    let impostor = Address::generate(&env);
    client.set_min_bids(&impostor, &5u32);
}

#[test]
#[should_panic(expected = "min bids must be at least 1")]
fn test_set_min_bids_zero() {
    let (_env, client, _rep_id, _ac_id, admin) = setup();
    client.set_min_bids(&admin, &0u32);
}

#[test]
fn test_tender_count() {
    let (env, client, _rep_id, _ac_id, _admin) = setup();
    let agency = Address::generate(&env);
    assert_eq!(client.get_tender_count(), 0);
    client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T1"), &make_string(&env, "D"), &1_000_000_i128, &100);
    client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "T2"), &make_string(&env, "D"), &2_000_000_i128, &200);
    assert_eq!(client.get_tender_count(), 2);
}

#[test]
fn test_reputation_affects_final_score() {
    let (env, client, reputation_id, ac_id, admin) = setup();
    let agency = Address::generate(&env);
    let good = Address::generate(&env);
    let bad = Address::generate(&env);

    register_entity(&env, &reputation_id, &good, EntityType::Contractor);
    register_entity(&env, &reputation_id, &bad, EntityType::Contractor);
    assign_role(&env, &ac_id, &admin, &good, &Role::Contractor);
    assign_role(&env, &ac_id, &admin, &bad, &Role::Contractor);

    let reputation_client = reputation::ReputationLedgerClient::new(&env, &reputation_id);
    reputation_client.record_audit_finding(&agency, &bad, &5);

    let tid = client.create_tender(&agency, &0u32, &0u32, &make_string(&env, "Test"), &make_string(&env, "Desc"), &10_000_000_i128, &1000);

    client.submit_bid(&good, &tid, &9_000_000_i128, &90, &30);
    client.submit_bid(&bad, &tid, &9_000_000_i128, &90, &30);

    let bids = client.get_bids_by_tender(&tid);
    assert_eq!(bids.len(), 2);

    let good_score = bids.iter().find(|b| b.contractor == good).unwrap().final_score;
    let bad_score = bids.iter().find(|b| b.contractor == bad).unwrap().final_score;

    assert!(good_score > bad_score);
}
