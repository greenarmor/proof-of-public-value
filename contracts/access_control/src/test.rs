#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as AddressTestUtils;
use soroban_sdk::{Address, Env, Vec};

fn setup() -> (Env, Address, AccessControlClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(AccessControl, ());
    let client = AccessControlClient::new(&env, &contract_id);
    client.initialize(&admin);
    (env, admin, client)
}

#[test]
fn test_initialize() {
    let (_env, _admin, client) = setup();
    let _retrieved_admin = client.get_admin();
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let (_env, admin, client) = setup();
    client.initialize(&admin);
}

#[test]
fn test_assign_and_check_role() {
    let (_env, admin, client) = setup();
    let citizen = Address::generate(&_env);

    assert!(!client.has_role(&citizen, &Role::Citizen));

    client.assign_role(&admin, &citizen, &Role::Citizen);

    assert!(client.has_role(&citizen, &Role::Citizen));
}

#[test]
fn test_revoke_role() {
    let (_env, admin, client) = setup();
    let contractor = Address::generate(&_env);

    client.assign_role(&admin, &contractor, &Role::Contractor);
    assert!(client.has_role(&contractor, &Role::Contractor));

    client.revoke_role(&admin, &contractor, &Role::Contractor);
    assert!(!client.has_role(&contractor, &Role::Contractor));
}

#[test]
fn test_multiple_roles_isolated() {
    let (_env, admin, client) = setup();
    let engineer = Address::generate(&_env);
    let auditor = Address::generate(&_env);

    client.assign_role(&admin, &engineer, &Role::Engineer);
    client.assign_role(&admin, &auditor, &Role::Auditor);

    assert!(client.has_role(&engineer, &Role::Engineer));
    assert!(!client.has_role(&engineer, &Role::Auditor));
    assert!(client.has_role(&auditor, &Role::Auditor));
    assert!(!client.has_role(&auditor, &Role::Engineer));
}

#[test]
fn test_get_role_assignment() {
    let (_env, admin, client) = setup();
    let user = Address::generate(&_env);

    client.assign_role(&admin, &user, &Role::Inspector);

    let assignment = client.get_role(&user).unwrap();
    assert_eq!(assignment.address, user);
    assert_eq!(assignment.role, Role::Inspector);
    assert_eq!(assignment.assigned_by, admin);
    assert!(assignment.active);
}

#[test]
fn test_get_addresses_by_role() {
    let (_env, admin, client) = setup();
    let c1 = Address::generate(&_env);
    let c2 = Address::generate(&_env);

    client.assign_role(&admin, &c1, &Role::Citizen);
    client.assign_role(&admin, &c2, &Role::Citizen);

    let citizens = client.get_addresses_by_role(&Role::Citizen);
    assert_eq!(citizens.len(), 2);
}

#[test]
fn test_has_any_role() {
    let (_env, admin, client) = setup();
    let user = Address::generate(&_env);

    client.assign_role(&admin, &user, &Role::Engineer);

    let roles = Vec::from_array(&_env, [Role::Auditor, Role::Engineer, Role::Inspector]);
    assert!(client.has_any_role(&user, &roles));

    let roles2 = Vec::from_array(&_env, [Role::Auditor, Role::Inspector]);
    assert!(!client.has_any_role(&user, &roles2));
}

#[test]
#[should_panic(expected = "only admin can manage roles")]
fn test_non_admin_cannot_assign() {
    let (_env, _admin, client) = setup();
    let impostor = Address::generate(&_env);
    let victim = Address::generate(&_env);

    client.assign_role(&impostor, &victim, &Role::Administrator);
}

#[test]
#[should_panic(expected = "address does not have required role")]
fn test_require_role_panics() {
    let (_env, _admin, client) = setup();
    let user = Address::generate(&_env);

    client.require_role(&user, &Role::CommissionOnAudit);
}

#[test]
fn test_require_role_passes() {
    let (_env, admin, client) = setup();
    let auditor = Address::generate(&_env);

    client.assign_role(&admin, &auditor, &Role::Auditor);
    client.require_role(&auditor, &Role::Auditor);
}
