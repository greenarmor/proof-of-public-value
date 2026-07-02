#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env};

fn setup() -> (Env, DynamicEscrowClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(DynamicEscrow, ());
    let client = DynamicEscrowClient::new(&env, &contract_id);
    client.initialize();
    (env, client)
}

fn create_test_escrow(env: &Env, client: &DynamicEscrowClient) -> u32 {
    let funder = Address::generate(env);
    let recipient = Address::generate(env);

    client.create_escrow(&funder, &recipient, &1, &1, &1_000_000, &2)
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
fn test_create_escrow() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.amount, 1_000_000);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.conditions.community_required, 2);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_create_escrow_zero_amount() {
    let (env, client) = setup();
    let funder = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.create_escrow(&funder, &recipient, &1, &1, &0, &1);
}

#[test]
fn test_fund_escrow() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Funded);
}

#[test]
#[should_panic(expected = "funding amount must match escrow amount")]
fn test_fund_wrong_amount() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &500_000);
}

#[test]
fn test_full_unlock_and_release() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let engineer = Address::generate(&env);
    let auditor = Address::generate(&env);
    let officer = Address::generate(&env);
    let citizen1 = Address::generate(&env);
    let citizen2 = Address::generate(&env);

    client.engineer_approve(&engineer, &id);
    client.ai_validate(&auditor, &id, &true);
    client.compliance_validate(&officer, &id, &true);
    client.add_community_confirmation(&citizen1, &id);
    client.add_community_confirmation(&citizen2, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Ready);

    let caller = Address::generate(&env);
    let released = client.release(&caller, &id);
    assert!(released);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Released);
}

#[test]
fn test_release_fails_without_conditions() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let engineer = Address::generate(&env);
    client.engineer_approve(&engineer, &id);

    let caller = Address::generate(&env);
    let released = client.release(&caller, &id);
    assert!(!released);
}

#[test]
fn test_refund() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let refunded = client.refund(&funder, &id);
    assert!(refunded);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Refunded);
}

#[test]
#[should_panic(expected = "cannot refund released escrow")]
fn test_refund_after_release() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let engineer = Address::generate(&env);
    let auditor = Address::generate(&env);
    let officer = Address::generate(&env);
    let citizen1 = Address::generate(&env);
    let citizen2 = Address::generate(&env);

    client.engineer_approve(&engineer, &id);
    client.ai_validate(&auditor, &id, &true);
    client.compliance_validate(&officer, &id, &true);
    client.add_community_confirmation(&citizen1, &id);
    client.add_community_confirmation(&citizen2, &id);

    let caller = Address::generate(&env);
    client.release(&caller, &id);

    client.refund(&funder, &id);
}

#[test]
fn test_dispute() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let disputer = Address::generate(&env);
    client.dispute(&disputer, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Disputed);
}

#[test]
fn test_refund_disputed() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let disputer = Address::generate(&env);
    client.dispute(&disputer, &id);

    let refunded = client.refund(&funder, &id);
    assert!(refunded);
}

#[test]
fn test_get_escrows_by_pvo() {
    let (env, client) = setup();
    let funder = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.create_escrow(&funder, &recipient, &1, &1, &500_000, &1);
    client.create_escrow(&funder, &recipient, &1, &2, &300_000, &1);
    client.create_escrow(&funder, &recipient, &2, &3, &200_000, &1);

    let pvo1_escrows = client.get_escrows_by_pvo(&1);
    assert_eq!(pvo1_escrows.len(), 2);
}

#[test]
fn test_get_escrow_count() {
    let (env, client) = setup();

    assert_eq!(client.get_escrow_count(), 0);

    create_test_escrow(&env, &client);
    assert_eq!(client.get_escrow_count(), 1);
}

#[test]
fn test_ai_validation_failure() {
    let (env, client) = setup();
    let id = create_test_escrow(&env, &client);

    let funder = client.get_escrow(&id).unwrap().funder;
    client.fund_escrow(&funder, &id, &1_000_000);

    let engineer = Address::generate(&env);
    let auditor = Address::generate(&env);
    client.engineer_approve(&engineer, &id);
    client.ai_validate(&auditor, &id, &false);

    let escrow = client.get_escrow(&id).unwrap();
    assert!(!escrow.conditions.ai_risk_check);
}
