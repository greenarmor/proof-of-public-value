#![cfg(test)]

use crate::{GrantCommitment, GrantCommitmentClient, GrantStatus};
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn setup_token<'a>(env: &'a Env, admin: &Address) -> (Address, pphp_token::PphpTokenClient<'a>) {
    let token_id = env.register(pphp_token::PphpToken, ());
    let token_client = pphp_token::PphpTokenClient::new(env, &token_id);
    token_client.initialize(admin, &2, &String::from_str(env, "pPHP"), &String::from_str(env, "pPHP"));
    (token_id, token_client)
}

fn setup() -> (Env, GrantCommitmentClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(GrantCommitment, ());
    let client = GrantCommitmentClient::new(&env, &contract_id);
    (env, client)
}

fn commit_with_token(
    env: &Env,
    client: &GrantCommitmentClient,
    token_client: &pphp_token::PphpTokenClient,
    token_id: &Address,
    donor: &Address,
    funding_agency: &Address,
    pvo_id: u32,
    amount: i128,
    org_name: &str,
) -> u32 {
    token_client.mint(donor, &amount);
    let id = client.commit_grant(
        donor, &pvo_id, &amount,
        &String::from_str(env, org_name),
        funding_agency, token_id,
    );
    id
}

#[test]
fn test_commit_grant_basic() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor = Address::generate(&env);
    let fa = Address::generate(&env);

    let id = commit_with_token(&env, &client, &token_client, &token_id, &donor, &fa, 1, 5_000_000_00, "World Bank");
    assert_eq!(id, 1);
}

#[test]
fn test_commit_transfers_tokens() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor = Address::generate(&env);
    let fa = Address::generate(&env);

    let amount = 5_000_000_00i128;
    commit_with_token(&env, &client, &token_client, &token_id, &donor, &fa, 1, amount, "World Bank");

    // Donor should have 0, funding agency should have the full amount
    assert_eq!(token_client.balance(&donor), 0);
    assert_eq!(token_client.balance(&fa), amount);
}

#[test]
fn test_commit_grant_stores_correctly() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor = Address::generate(&env);
    let fa = Address::generate(&env);

    let id = commit_with_token(&env, &client, &token_client, &token_id, &donor, &fa, 3, 1_200_000_00, "JICA");

    let grant = client.get_grant(&id).unwrap();
    assert_eq!(grant.id, 1);
    assert_eq!(grant.pvo_id, 3);
    assert_eq!(grant.donor, donor);
    assert_eq!(grant.amount, 1_200_000_00);
    assert_eq!(grant.org_name, String::from_str(&env, "JICA"));
    assert_eq!(grant.status, GrantStatus::Committed);
}

#[test]
fn test_commit_multiple_grants() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    let fa = Address::generate(&env);

    let id1 = commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 1, 500_000_00, "World Bank");
    let id2 = commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 2, 300_000_00, "World Bank");
    let id3 = commit_with_token(&env, &client, &token_client, &token_id, &donor2, &fa, 1, 800_000_00, "USAID");

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
    assert_eq!(client.get_grant_count(), 3);
    // FA got all three amounts
    assert_eq!(token_client.balance(&fa), 1_600_000_00);
}

#[test]
fn test_get_grants_by_pvo() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    let fa = Address::generate(&env);

    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 1, 500_000_00, "World Bank");
    commit_with_token(&env, &client, &token_client, &token_id, &donor2, &fa, 1, 300_000_00, "USAID");
    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 2, 700_000_00, "World Bank");

    assert_eq!(client.get_grants_by_pvo(&1).len(), 2);
    assert_eq!(client.get_grants_by_pvo(&2).len(), 1);
    assert_eq!(client.get_grants_by_pvo(&3).len(), 0);
}

#[test]
fn test_get_grants_by_donor() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    let fa = Address::generate(&env);

    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 1, 500_000_00, "World Bank");
    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 2, 300_000_00, "World Bank");
    commit_with_token(&env, &client, &token_client, &token_id, &donor2, &fa, 1, 800_000_00, "USAID");

    assert_eq!(client.get_grants_by_donor(&donor1).len(), 2);
    assert_eq!(client.get_grants_by_donor(&donor2).len(), 1);
}

#[test]
fn test_update_status() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor = Address::generate(&env);
    let fa = Address::generate(&env);

    let id = commit_with_token(&env, &client, &token_client, &token_id, &donor, &fa, 1, 500_000_00, "World Bank");

    client.update_status(&donor, &id, &GrantStatus::Disbursed);
    let grant = client.get_grant(&id).unwrap();
    assert_eq!(grant.status, GrantStatus::Disbursed);
}

#[test]
#[should_panic(expected = "only the original donor")]
fn test_update_status_wrong_donor() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    let fa = Address::generate(&env);

    let id = commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 1, 500_000_00, "World Bank");
    client.update_status(&donor2, &id, &GrantStatus::Disbursed);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_commit_zero_amount() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, _) = setup_token(&env, &admin);
    let donor = Address::generate(&env);
    let fa = Address::generate(&env);
    client.commit_grant(&donor, &1, &0, &String::from_str(&env, "World Bank"), &fa, &token_id);
}

#[test]
fn test_get_all_grants() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    let fa = Address::generate(&env);

    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 1, 500_000_00, "World Bank");
    commit_with_token(&env, &client, &token_client, &token_id, &donor2, &fa, 2, 300_000_00, "USAID");
    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 3, 700_000_00, "World Bank");

    assert_eq!(client.get_all_grants().len(), 3);
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

#[test]
fn test_status_progression() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor = Address::generate(&env);
    let fa = Address::generate(&env);

    let id = commit_with_token(&env, &client, &token_client, &token_id, &donor, &fa, 1, 500_000_00, "JICA");

    client.update_status(&donor, &id, &GrantStatus::Disbursed);
    assert_eq!(client.get_grant(&id).unwrap().status, GrantStatus::Disbursed);

    client.update_status(&donor, &id, &GrantStatus::Completed);
    assert_eq!(client.get_grant(&id).unwrap().status, GrantStatus::Completed);

    client.update_status(&donor, &id, &GrantStatus::Cancelled);
    assert_eq!(client.get_grant(&id).unwrap().status, GrantStatus::Cancelled);
}

#[test]
fn test_donor_isolation() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_id, token_client) = setup_token(&env, &admin);
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);
    let fa = Address::generate(&env);

    commit_with_token(&env, &client, &token_client, &token_id, &donor1, &fa, 1, 500_000_00, "World Bank");
    commit_with_token(&env, &client, &token_client, &token_id, &donor2, &fa, 1, 800_000_00, "USAID");

    let pvo_grants = client.get_grants_by_pvo(&1);
    assert_eq!(pvo_grants.len(), 2);

    let d1_grants = client.get_grants_by_donor(&donor1);
    assert_eq!(d1_grants.len(), 1);
    assert_eq!(d1_grants.get(0).unwrap().org_name, String::from_str(&env, "World Bank"));

    let d2_grants = client.get_grants_by_donor(&donor2);
    assert_eq!(d2_grants.len(), 1);
    assert_eq!(d2_grants.get(0).unwrap().org_name, String::from_str(&env, "USAID"));
}
