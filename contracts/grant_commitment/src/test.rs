#![cfg(test)]

use crate::{GrantCommitment, GrantCommitmentClient, GrantStatus};
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String, Symbol};

fn register_pvo_core(env: &Env) -> Address {
    let pvo_id = env.register(pvo_core::PVOCore, ());
    let client = pvo_core::PVOCoreClient::new(env, &pvo_id);
    client.initialize();

    let creator = Address::generate(env);
    let fa = Address::generate(env);
    let ctr = Address::generate(env);
    let pm = Address::generate(env);
    client.create_pvo(
        &creator,
        &String::from_str(env, "Test PVO"),
        &String::from_str(env, "desc"),
        &fa, &ctr, &pm,
        &String::from_str(env, "DPWH"),
        &String::from_str(env, "Manila"),
        &1_000_000_000i128,
        &String::from_str(env, "National Budget"),
        &0u64,
    );
    pvo_id
}

fn setup() -> (Env, GrantCommitmentClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let pvo_core_id = register_pvo_core(&env);
    let admin = Address::generate(&env);
    let contract_id = env.register(GrantCommitment, ());
    let client = GrantCommitmentClient::new(&env, &contract_id);
    client.initialize(&pvo_core_id, &admin);
    (env, client)
}

fn setup_pvo_with_budget(budget: i128) -> (Env, GrantCommitmentClient<'static>, pvo_core::PVOCoreClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let pvo_core_id = env.register(pvo_core::PVOCore, ());
    let pvo_client = pvo_core::PVOCoreClient::new(&env, &pvo_core_id);
    pvo_client.initialize();

    let creator = Address::generate(&env);
    let fa = Address::generate(&env);
    let ctr = Address::generate(&env);
    let pm = Address::generate(&env);
    pvo_client.create_pvo(
        &creator,
        &String::from_str(&env, "Test"),
        &String::from_str(&env, "desc"),
        &fa, &ctr, &pm,
        &String::from_str(&env, "DPWH"),
        &String::from_str(&env, "Manila"),
        &budget,
        &String::from_str(&env, "Fund"),
        &0u64,
    );

    let admin = Address::generate(&env);
    let contract_id = env.register(GrantCommitment, ());
    let client = GrantCommitmentClient::new(&env, &contract_id);
    client.initialize(&pvo_core_id, &admin);
    (env, client, pvo_client)
}

fn commit_exact(
    env: &Env,
    client: &GrantCommitmentClient,
    donor: &Address,
    pvo_id: u32,
    amount: i128,
    org_name: &str,
    currency: &str,
) -> u32 {
    client.commit_grant(
        donor, &pvo_id, &amount,
        &String::from_str(env, org_name),
        &String::from_str(env, currency),
    )
}

#[test]
fn test_commit_exact_amount() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    // Must pledge exactly the full budget (no prior pledges)
    let id = commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");
    assert_eq!(id, 1);

    let grant = client.get_grant(&id).unwrap();
    assert_eq!(grant.amount, 1_000_000_000);
    assert_eq!(grant.status, GrantStatus::Committed);
}

#[test]
#[should_panic(expected = "pledge must exactly match")]
fn test_commit_wrong_amount_fails() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    // Try to pledge less than the full budget
    commit_exact(&env, &client, &donor, 1, 500_000_000, "World Bank", "USD");
}

#[test]
#[should_panic(expected = "pledge must exactly match")]
fn test_commit_more_than_budget_fails() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    commit_exact(&env, &client, &donor, 1, 2_000_000_000, "World Bank", "USD");
}

#[test]
fn test_pvo_fully_funded_blocks_new_pledge() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    // First donor pledges exact full budget
    commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");

    // Remaining is 0, so any new pledge fails
    let donor2 = Address::generate(&env);
    let result = client.try_commit_grant(
        &donor2, &1u32, &0i128,
        &String::from_str(&env, "USAID"),
        &String::from_str(&env, "EUR"),
    );
    assert!(result.is_err());
}

#[test]
fn test_get_pvo_remaining() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);

    // Initially, remaining = full budget
    assert_eq!(client.get_pvo_remaining(&1u32), 1_000_000_000);

    let donor = Address::generate(&env);
    commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");

    // After full pledge, remaining = 0
    assert_eq!(client.get_pvo_remaining(&1u32), 0);
}

#[test]
fn test_get_committed_total() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);

    assert_eq!(client.get_committed_total(&1u32), 0);

    let donor = Address::generate(&env);
    commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");

    assert_eq!(client.get_committed_total(&1u32), 1_000_000_000);
}

#[test]
fn test_cancelled_grant_excluded_from_committed() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    // Pledge exact amount, then cancel
    let id = commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");
    assert_eq!(client.get_committed_total(&1u32), 1_000_000_000);

    client.update_status(&donor, &id, &GrantStatus::Cancelled);

    // Cancelled grants don't count toward committed total
    assert_eq!(client.get_committed_total(&1u32), 0);
    assert_eq!(client.get_pvo_remaining(&1u32), 1_000_000_000);
}

#[test]
fn test_admin_mark_disbursed() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);
    let admin = Address::generate(&env);

    let id = commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");

    client.admin_mark_disbursed(&admin, &id);
    let grant = client.get_grant(&id).unwrap();
    assert_eq!(grant.status, GrantStatus::Disbursed);
}

#[test]
#[should_panic(expected = "grant must be in Committed status")]
fn test_admin_mark_disbursed_already_disbursed() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);
    let admin = Address::generate(&env);

    let id = commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");
    client.admin_mark_disbursed(&admin, &id);
    client.admin_mark_disbursed(&admin, &id);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_commit_zero_amount() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);
    client.commit_grant(
        &donor, &1, &0,
        &String::from_str(&env, "World Bank"),
        &String::from_str(&env, "USD"),
    );
}

#[test]
fn test_get_grants_by_pvo() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");
    assert_eq!(client.get_grants_by_pvo(&1).len(), 1);
    assert_eq!(client.get_grants_by_pvo(&2).len(), 0);
}

#[test]
fn test_get_grants_by_donor() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");
    assert_eq!(client.get_grants_by_donor(&donor).len(), 1);
}

#[test]
fn test_get_all_grants() {
    let (env, client, _) = setup_pvo_with_budget(1_000_000_000);
    let donor = Address::generate(&env);

    commit_exact(&env, &client, &donor, 1, 1_000_000_000, "World Bank", "USD");
    assert_eq!(client.get_all_grants().len(), 1);
}

#[test]
fn test_get_nonexistent_grant() {
    let (_env, client) = setup();
    assert_eq!(client.get_grant(&999), None);
}

#[test]
fn test_grant_count_starts_zero() {
    let (_env, client) = setup();
    assert_eq!(client.get_grant_count(), 0);
}
