#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, String, Symbol};

fn register_compliance(env: &Env) -> Address {
    let comp_id = env.register(compliance_engine::ComplianceEngine, ());
    let client = compliance_engine::ComplianceEngineClient::new(env, &comp_id);
    client.initialize();
    comp_id
}

fn register_community(env: &Env) -> Address {
    let oracle_id = env.register(community_oracle::CommunityOracle, ());
    let client = community_oracle::CommunityOracleClient::new(env, &oracle_id);
    client.initialize();

    let admin = Address::generate(env);
    client.set_citizen_credential(&admin, &0i128);

    let citizen = Address::generate(env);
    let report_id = client.submit_report(
        &citizen, &1u32, &1u32,
        &community_oracle::ReportType::GpsPhoto,
        &String::from_str(env, "hash"),
        &1412364i128, &1210437i128,
    );

    let verifier = Address::generate(env);
    client.verify_report(&verifier, &report_id, &50u32);

    oracle_id
}


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

fn setup() -> (Env, DynamicEscrowClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let compliance_id = register_compliance(&env);
    let oracle_id = register_community(&env);
    let pvo_core_id = register_pvo_core(&env);
    let contract_id = env.register(DynamicEscrow, ());
    let client = DynamicEscrowClient::new(&env, &contract_id);
    client.initialize(&compliance_id, &oracle_id, &pvo_core_id);
    (env, client)
}

fn register_token<'a>(env: &'a Env, admin: &Address) -> (Address, pphp_token::PphpTokenClient<'a>) {
    let token_id = env.register(pphp_token::PphpToken, ());
    let token_client = pphp_token::PphpTokenClient::new(env, &token_id);
    token_client.initialize(admin, &2, &String::from_str(env, "pPHP"), &String::from_str(env, "pPHP"));
    (token_id, token_client)
}

fn setup_with_token() -> (Env, DynamicEscrowClient<'static>, pphp_token::PphpTokenClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let compliance_id = register_compliance(&env);
    let oracle_id = register_community(&env);
    let pvo_core_id = register_pvo_core(&env);
    let contract_id = env.register(DynamicEscrow, ());
    let client = DynamicEscrowClient::new(&env, &contract_id);
    client.initialize(&compliance_id, &oracle_id, &pvo_core_id);

    let admin = Address::generate(&env);
    let token_id = env.register(pphp_token::PphpToken, ());
    let token_client = pphp_token::PphpTokenClient::new(&env, &token_id);
    token_client.initialize(&admin, &2, &String::from_str(&env, "pPHP"), &String::from_str(&env, "pPHP"));

    (env, client, token_client)
}

fn create_and_fund(env: &Env, client: &DynamicEscrowClient, token_client: &pphp_token::PphpTokenClient<'_>) -> (u32, Address, Address) {
    let funder = Address::generate(env);
    let recipient = Address::generate(env);
    let token_addr = token_client.address.clone();

    let id = client.create_escrow(&funder, &recipient, &1, &1, &1_000_000, &token_addr, &2);
    token_client.mint(&funder, &1_000_000);
    client.fund_escrow(&funder, &id, &1_000_000);
    (id, funder, recipient)
}

#[test]
fn test_initialize() {
    let (_env, _client) = setup();
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let (env, client) = setup();
    let dummy = Address::generate(&env);
    client.initialize(&dummy, &dummy, &dummy);
}

#[test]
fn test_create_escrow() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_addr, _) = register_token(&env, &admin);
    let funder = Address::generate(&env);
    let recipient = Address::generate(&env);

    let id = client.create_escrow(&funder, &recipient, &1, &1, &1_000_000, &token_addr, &2);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.amount, 1_000_000);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.conditions.community_required, 2);
    assert_eq!(escrow.token_address, token_addr);
    assert_eq!(escrow.conditions.community_oracle_validation, false);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_create_escrow_zero_amount() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_addr, _) = register_token(&env, &admin);
    let funder = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.create_escrow(&funder, &recipient, &1, &1, &0, &token_addr, &1);
}

#[test]
fn test_fund_escrow() {
    let (env, client, token_client) = setup_with_token();
    let (id, funder, _) = create_and_fund(&env, &client, &token_client);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Funded);

    let funder_balance = token_client.balance(&funder);
    assert_eq!(funder_balance, 0);
}

#[test]
#[should_panic(expected = "funding amount must match escrow amount")]
fn test_fund_wrong_amount() {
    let (env, client, token_client) = setup_with_token();
    let token_addr = token_client.address.clone();
    let funder = Address::generate(&env);

    let id = client.create_escrow(&funder, &Address::generate(&env), &1, &1, &1_000_000, &token_addr, &2);

    token_client.mint(&funder, &500_000);
    client.fund_escrow(&funder, &id, &500_000);
}

#[test]
fn test_full_unlock_and_release() {
    let (env, client, token_client) = setup_with_token();
    let (id, funder, recipient) = create_and_fund(&env, &client, &token_client);

    let engineer = Address::generate(&env);
    let auditor = Address::generate(&env);
    let officer = Address::generate(&env);
    let citizen1 = Address::generate(&env);
    let citizen2 = Address::generate(&env);

    client.engineer_approve(&engineer, &id);
    client.ai_validate(&auditor, &id, &true);
    client.compliance_validate(&officer, &id, &true);
    client.community_oracle_validate(&citizen1, &id);
    client.add_community_confirmation(&citizen1, &id);
    client.add_community_confirmation(&citizen2, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Ready);

    let caller = Address::generate(&env);
    let released = client.release(&caller, &id);
    assert!(released);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Released);

    let recipient_balance = token_client.balance(&recipient);
    assert_eq!(recipient_balance, 1_000_000);
}

#[test]
fn test_release_fails_without_conditions() {
    let (env, client, token_client) = setup_with_token();
    let (id, _, _) = create_and_fund(&env, &client, &token_client);

    let engineer = Address::generate(&env);
    client.engineer_approve(&engineer, &id);

    let caller = Address::generate(&env);
    let released = client.release(&caller, &id);
    assert!(!released);
}

#[test]
fn test_refund() {
    let (env, client, token_client) = setup_with_token();
    let (id, funder, _) = create_and_fund(&env, &client, &token_client);

    let refunded = client.refund(&funder, &id);
    assert!(refunded);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Refunded);

    let funder_balance = token_client.balance(&funder);
    assert_eq!(funder_balance, 1_000_000);
}

#[test]
#[should_panic(expected = "cannot refund released escrow")]
fn test_refund_after_release() {
    let (env, client, token_client) = setup_with_token();
    let (id, funder, _) = create_and_fund(&env, &client, &token_client);

    let engineer = Address::generate(&env);
    let auditor = Address::generate(&env);
    let officer = Address::generate(&env);
    let citizen1 = Address::generate(&env);
    let citizen2 = Address::generate(&env);

    client.engineer_approve(&engineer, &id);
    client.ai_validate(&auditor, &id, &true);
    client.compliance_validate(&officer, &id, &true);
    client.community_oracle_validate(&citizen1, &id);
    client.add_community_confirmation(&citizen1, &id);
    client.add_community_confirmation(&citizen2, &id);

    let caller = Address::generate(&env);
    client.release(&caller, &id);

    client.refund(&funder, &id);
}

#[test]
fn test_dispute() {
    let (env, client, token_client) = setup_with_token();
    let (id, _, _) = create_and_fund(&env, &client, &token_client);

    let disputer = Address::generate(&env);
    client.dispute(&disputer, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, EscrowStatus::Disputed);
}

#[test]
fn test_refund_disputed() {
    let (env, client, token_client) = setup_with_token();
    let (id, funder, _) = create_and_fund(&env, &client, &token_client);

    let disputer = Address::generate(&env);
    client.dispute(&disputer, &id);

    let refunded = client.refund(&funder, &id);
    assert!(refunded);

    let funder_balance = token_client.balance(&funder);
    assert_eq!(funder_balance, 1_000_000);
}

#[test]
fn test_get_escrows_by_pvo() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_addr, _) = register_token(&env, &admin);
    let funder = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.create_escrow(&funder, &recipient, &1, &1, &500_000, &token_addr, &1);
    client.create_escrow(&funder, &recipient, &1, &2, &300_000, &token_addr, &1);
    client.create_escrow(&funder, &recipient, &2, &3, &200_000, &token_addr, &1);

    let pvo1_escrows = client.get_escrows_by_pvo(&1);
    assert_eq!(pvo1_escrows.len(), 2);
}

#[test]
fn test_get_escrow_count() {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    let (token_addr, _) = register_token(&env, &admin);

    assert_eq!(client.get_escrow_count(), 0);

    let funder = Address::generate(&env);
    let recipient = Address::generate(&env);
    client.create_escrow(&funder, &recipient, &1, &1, &1_000_000, &token_addr, &2);

    assert_eq!(client.get_escrow_count(), 1);
}

#[test]
fn test_ai_validation_failure() {
    let (env, client, token_client) = setup_with_token();
    let (id, _, _) = create_and_fund(&env, &client, &token_client);

    let engineer = Address::generate(&env);
    let auditor = Address::generate(&env);
    client.engineer_approve(&engineer, &id);
    client.ai_validate(&auditor, &id, &false);

    let escrow = client.get_escrow(&id).unwrap();
    assert!(!escrow.conditions.ai_risk_check);
}
