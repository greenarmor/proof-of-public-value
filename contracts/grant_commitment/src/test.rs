#![cfg(test)]

use crate::{GrantCommitment, GrantCommitmentClient, GrantStatus};
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String};

fn setup() -> (Env, GrantCommitmentClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(GrantCommitment, ());
    let client = GrantCommitmentClient::new(&env, &contract_id);
    (env, client)
}

#[test]
fn test_commit_grant_basic() {
    let (env, client) = setup();
    let donor = Address::generate(&env);

    let id = client.commit_grant(&donor, &1, &5_000_000_00, &String::from_str(&env, "World Bank"));
    assert_eq!(id, 1);
}

#[test]
fn test_commit_grant_stores_correctly() {
    let (env, client) = setup();
    let donor = Address::generate(&env);

    let id = client.commit_grant(&donor, &3, &1_200_000_00, &String::from_str(&env, "JICA"));

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
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);

    let id1 = client.commit_grant(&donor1, &1, &500_000_00, &String::from_str(&env, "World Bank"));
    let id2 = client.commit_grant(&donor1, &2, &300_000_00, &String::from_str(&env, "World Bank"));
    let id3 = client.commit_grant(&donor2, &1, &800_000_00, &String::from_str(&env, "USAID"));

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
    assert_eq!(client.get_grant_count(), 3);
}

#[test]
fn test_get_grants_by_pvo() {
    let (env, client) = setup();
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);

    client.commit_grant(&donor1, &1, &500_000_00, &String::from_str(&env, "World Bank"));
    client.commit_grant(&donor2, &1, &300_000_00, &String::from_str(&env, "USAID"));
    client.commit_grant(&donor1, &2, &700_000_00, &String::from_str(&env, "World Bank"));

    assert_eq!(client.get_grants_by_pvo(&1).len(), 2);
    assert_eq!(client.get_grants_by_pvo(&2).len(), 1);
    assert_eq!(client.get_grants_by_pvo(&3).len(), 0);
}

#[test]
fn test_get_grants_by_donor() {
    let (env, client) = setup();
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);

    client.commit_grant(&donor1, &1, &500_000_00, &String::from_str(&env, "World Bank"));
    client.commit_grant(&donor1, &2, &300_000_00, &String::from_str(&env, "World Bank"));
    client.commit_grant(&donor2, &1, &800_000_00, &String::from_str(&env, "USAID"));

    assert_eq!(client.get_grants_by_donor(&donor1).len(), 2);
    assert_eq!(client.get_grants_by_donor(&donor2).len(), 1);
}

#[test]
fn test_update_status() {
    let (env, client) = setup();
    let donor = Address::generate(&env);

    let id = client.commit_grant(&donor, &1, &500_000_00, &String::from_str(&env, "World Bank"));

    client.update_status(&donor, &id, &GrantStatus::Disbursed);
    let grant = client.get_grant(&id).unwrap();
    assert_eq!(grant.status, GrantStatus::Disbursed);
}

#[test]
#[should_panic(expected = "only the original donor")]
fn test_update_status_wrong_donor() {
    let (env, client) = setup();
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);

    let id = client.commit_grant(&donor1, &1, &500_000_00, &String::from_str(&env, "World Bank"));
    client.update_status(&donor2, &id, &GrantStatus::Disbursed);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_commit_zero_amount() {
    let (env, client) = setup();
    let donor = Address::generate(&env);
    client.commit_grant(&donor, &1, &0, &String::from_str(&env, "World Bank"));
}

#[test]
fn test_get_all_grants() {
    let (env, client) = setup();
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);

    client.commit_grant(&donor1, &1, &500_000_00, &String::from_str(&env, "World Bank"));
    client.commit_grant(&donor2, &2, &300_000_00, &String::from_str(&env, "USAID"));
    client.commit_grant(&donor1, &3, &700_000_00, &String::from_str(&env, "World Bank"));

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
    let donor = Address::generate(&env);

    let id = client.commit_grant(&donor, &1, &500_000_00, &String::from_str(&env, "JICA"));

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
    let donor1 = Address::generate(&env);
    let donor2 = Address::generate(&env);

    client.commit_grant(&donor1, &1, &500_000_00, &String::from_str(&env, "World Bank"));
    client.commit_grant(&donor2, &1, &800_000_00, &String::from_str(&env, "USAID"));

    let pvo_grants = client.get_grants_by_pvo(&1);
    assert_eq!(pvo_grants.len(), 2);

    let d1_grants = client.get_grants_by_donor(&donor1);
    assert_eq!(d1_grants.len(), 1);
    assert_eq!(d1_grants.get(0).unwrap().org_name, String::from_str(&env, "World Bank"));

    let d2_grants = client.get_grants_by_donor(&donor2);
    assert_eq!(d2_grants.len(), 1);
    assert_eq!(d2_grants.get(0).unwrap().org_name, String::from_str(&env, "USAID"));
}
