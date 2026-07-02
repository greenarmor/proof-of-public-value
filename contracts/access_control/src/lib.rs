#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Role {
    Citizen,
    Engineer,
    Inspector,
    Contractor,
    Supplier,
    ProjectManager,
    GovernmentAgency,
    Auditor,
    CommissionOnAudit,
    AntiCorruptionAgency,
    FundingAgency,
    InternationalDonor,
    Administrator,
    AIAuditor,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleAssignment {
    pub address: Address,
    pub role: Role,
    pub assigned_by: Address,
    pub assigned_at: u64,
    pub active: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleAssignedEvent {
    pub address: Address,
    pub role: Role,
    pub assigned_by: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleRevokedEvent {
    pub address: Address,
    pub role: Role,
    pub revoked_by: Address,
}

const ROLES: Symbol = symbol_short!("ROLES");
const ADMIN: Symbol = symbol_short!("ADMIN");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct AccessControl;

#[contractimpl]
impl AccessControl {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&ADMIN, &admin);
        storage.set(&INITIALIZED, &true);
    }

    pub fn assign_role(env: Env, assigner: Address, address: Address, role: Role) {
        assigner.require_auth();
        Self::require_admin(&env, &assigner);

        let storage = env.storage().persistent();
        let mut roles: Vec<Address> = storage.get(&Self::role_key(&role)).unwrap_or_else(|| Vec::new(&env));
        if !roles.contains(&address) {
            roles.push_back(address.clone());
        }

        let mut assignments: Map<Address, RoleAssignment> = storage.get(&ROLES).unwrap_or_else(|| Map::new(&env));
        assignments.set(
            address.clone(),
            RoleAssignment {
                address: address.clone(),
                role: role.clone(),
                assigned_by: assigner.clone(),
                assigned_at: env.ledger().timestamp(),
                active: true,
            },
        );

        storage.set(&Self::role_key(&role), &roles);
        storage.set(&ROLES, &assignments);

        RoleAssignedEvent { address, role, assigned_by: assigner }.publish(&env);
    }

    pub fn revoke_role(env: Env, revoker: Address, address: Address, role: Role) {
        revoker.require_auth();
        Self::require_admin(&env, &revoker);

        let storage = env.storage().persistent();
        let mut roles: Vec<Address> = storage.get(&Self::role_key(&role)).unwrap_or_else(|| Vec::new(&env));
        let mut idx = 0u32;
        while idx < roles.len() {
            if let Some(a) = roles.get(idx) {
                if a == address {
                    roles.remove(idx);
                    break;
                }
            }
            idx += 1;
        }

        let mut assignments: Map<Address, RoleAssignment> = storage.get(&ROLES).unwrap_or_else(|| Map::new(&env));
        if let Some(mut assignment) = assignments.get(address.clone()) {
            assignment.active = false;
            assignments.set(address.clone(), assignment);
        }

        storage.set(&Self::role_key(&role), &roles);
        storage.set(&ROLES, &assignments);

        RoleRevokedEvent { address, role, revoked_by: revoker }.publish(&env);
    }

    pub fn has_role(env: Env, address: Address, role: Role) -> bool {
        let storage = env.storage().persistent();
        let assignments: Map<Address, RoleAssignment> = storage.get(&ROLES).unwrap_or_else(|| Map::new(&env));
        match assignments.get(address) {
            Some(assignment) => assignment.active && assignment.role == role,
            None => false,
        }
    }

    pub fn has_any_role(env: Env, address: Address, roles: Vec<Role>) -> bool {
        let storage = env.storage().persistent();
        let assignments: Map<Address, RoleAssignment> = storage.get(&ROLES).unwrap_or_else(|| Map::new(&env));
        let assignment = assignments.get(address);

        for i in 0..roles.len() {
            if let Some(role) = roles.get(i) {
                if let Some(ref a) = assignment {
                    if a.active && a.role == role {
                        return true;
                    }
                }
            }
        }
        false
    }

    pub fn get_role(env: Env, address: Address) -> Option<RoleAssignment> {
        let storage = env.storage().persistent();
        let assignments: Map<Address, RoleAssignment> = storage.get(&ROLES).unwrap_or_else(|| Map::new(&env));
        assignments.get(address)
    }

    pub fn get_addresses_by_role(env: Env, role: Role) -> Vec<Address> {
        let storage = env.storage().persistent();
        let roles: Vec<Address> = storage.get(&Self::role_key(&role)).unwrap_or_else(|| Vec::new(&env));
        roles
    }

    pub fn require_role(env: Env, address: Address, role: Role) {
        if !Self::has_role(env, address, role) {
            panic!("address does not have required role");
        }
    }

    pub fn get_admin(env: Env) -> Address {
        let storage = env.storage().persistent();
        storage.get(&ADMIN).expect("not initialized")
    }

    fn role_key(role: &Role) -> Symbol {
        match role {
            Role::Citizen => symbol_short!("R_CITIZEN"),
            Role::Engineer => symbol_short!("R_ENG"),
            Role::Inspector => symbol_short!("R_INSP"),
            Role::Contractor => symbol_short!("R_CONTR"),
            Role::Supplier => symbol_short!("R_SUPP"),
            Role::ProjectManager => symbol_short!("R_PM"),
            Role::GovernmentAgency => symbol_short!("R_GOV"),
            Role::Auditor => symbol_short!("R_AUDIT"),
            Role::CommissionOnAudit => symbol_short!("R_COA"),
            Role::AntiCorruptionAgency => symbol_short!("R_ACA"),
            Role::FundingAgency => symbol_short!("R_FUND"),
            Role::InternationalDonor => symbol_short!("R_DONOR"),
            Role::Administrator => symbol_short!("R_ADMIN"),
            Role::AIAuditor => symbol_short!("R_AI"),
        }
    }

    fn require_admin(env: &Env, address: &Address) {
        let storage = env.storage().persistent();
        let admin: Address = storage.get(&ADMIN).expect("not initialized");
        if &admin != address {
            panic!("only admin can manage roles");
        }
    }
}

mod test;
