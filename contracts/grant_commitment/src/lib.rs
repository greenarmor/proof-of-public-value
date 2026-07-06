#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GrantStatus {
    Committed,
    Disbursed,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Grant {
    pub id: u32,
    pub pvo_id: u32,
    pub donor: Address,
    pub amount: i128,
    pub org_name: String,
    pub currency: String,
    pub status: GrantStatus,
    pub created_at: u64,
    pub updated_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GrantCommittedEvent {
    pub id: u32,
    pub pvo_id: u32,
    pub donor: Address,
    pub amount: i128,
    pub org_name: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GrantStatusUpdatedEvent {
    pub id: u32,
    pub old_status: GrantStatus,
    pub new_status: GrantStatus,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const GRANTS: Symbol = symbol_short!("GRANTS");
const PVO_INDEX: Symbol = symbol_short!("PVO_IDX");
const DONOR_INDEX: Symbol = symbol_short!("DONOR_IDX");
const PVO_CORE: Symbol = symbol_short!("PVOCORE");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct GrantCommitment;

#[contractimpl]
impl GrantCommitment {
    pub fn initialize(env: Env, pvo_core: Address) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&PVO_CORE, &pvo_core);
        storage.set(&INITIALIZED, &true);
    }

    pub fn commit_grant(
        env: Env,
        donor: Address,
        pvo_id: u32,
        amount: i128,
        org_name: String,
        currency: String,
    ) -> u32 {
        donor.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        // Enforce exact remaining amount: pledge must equal (budget - already committed)
        let remaining = Self::get_pvo_remaining(env.clone(), pvo_id);
        if amount != remaining {
            panic!("pledge must exactly match the remaining PVO budget");
        }

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();

        let grant = Grant {
            id,
            pvo_id,
            donor: donor.clone(),
            amount,
            org_name: org_name.clone(),
            currency: currency.clone(),
            status: GrantStatus::Committed,
            created_at: now,
            updated_at: now,
        };

        let storage = env.storage().persistent();

        let mut grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));
        grants.set(id, grant);
        storage.set(&GRANTS, &grants);

        Self::add_to_pvo_index(&env, pvo_id, id);
        Self::add_to_donor_index(&env, &donor, id);

        GrantCommittedEvent { id, pvo_id, donor, amount, org_name }.publish(&env);

        id
    }

    pub fn update_status(env: Env, donor: Address, grant_id: u32, new_status: GrantStatus) {
        donor.require_auth();

        let storage = env.storage().persistent();
        let mut grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));
        let mut grant = grants.get(grant_id).expect("grant not found");

        if grant.donor != donor {
            panic!("only the original donor can update this grant");
        }

        let old_status = grant.status.clone();
        grant.status = new_status.clone();
        grant.updated_at = env.ledger().timestamp();
        grants.set(grant_id, grant);
        storage.set(&GRANTS, &grants);

        GrantStatusUpdatedEvent { id: grant_id, old_status, new_status }.publish(&env);
    }

    pub fn admin_mark_disbursed(env: Env, caller: Address, grant_id: u32) {
        caller.require_auth();

        let storage = env.storage().persistent();
        let mut grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));
        let mut grant = grants.get(grant_id).expect("grant not found");

        if grant.status != GrantStatus::Committed {
            panic!("grant must be in Committed status to disburse");
        }

        let old_status = grant.status.clone();
        grant.status = GrantStatus::Disbursed;
        grant.updated_at = env.ledger().timestamp();
        grants.set(grant_id, grant);
        storage.set(&GRANTS, &grants);

        GrantStatusUpdatedEvent { id: grant_id, old_status, new_status: GrantStatus::Disbursed }.publish(&env);
    }

    pub fn get_grant(env: Env, grant_id: u32) -> Option<Grant> {
        let storage = env.storage().persistent();
        let grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));
        grants.get(grant_id)
    }

    pub fn get_grants_by_pvo(env: Env, pvo_id: u32) -> Vec<Grant> {
        let storage = env.storage().persistent();
        let pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_INDEX).unwrap_or_else(|| Map::new(&env));
        let grant_ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(&env));

        let grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));
        let mut result = Vec::new(&env);
        let mut i = 0u32;
        while i < grant_ids.len() {
            if let Some(id) = grant_ids.get(i) {
                if let Some(g) = grants.get(id) {
                    result.push_back(g);
                }
            }
            i += 1;
        }
        result
    }

    pub fn get_grants_by_donor(env: Env, donor: Address) -> Vec<Grant> {
        let storage = env.storage().persistent();
        let donor_index: Map<Address, Vec<u32>> = storage.get(&DONOR_INDEX).unwrap_or_else(|| Map::new(&env));
        let grant_ids = donor_index.get(donor).unwrap_or_else(|| Vec::new(&env));

        let grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));
        let mut result = Vec::new(&env);
        let mut i = 0u32;
        while i < grant_ids.len() {
            if let Some(id) = grant_ids.get(i) {
                if let Some(g) = grants.get(id) {
                    result.push_back(g);
                }
            }
            i += 1;
        }
        result
    }

    pub fn get_all_grants(env: Env) -> Vec<Grant> {
        let storage = env.storage().persistent();
        let grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));

        let mut result = Vec::new(&env);
        let mut i = 1u32;
        loop {
            if !grants.contains_key(i) {
                break;
            }
            if let Some(g) = grants.get(i) {
                result.push_back(g);
            }
            i += 1;
        }
        result
    }

    pub fn get_grant_count(env: Env) -> u32 {
        env.storage().persistent().get(&COUNTER).unwrap_or(0)
    }

    pub fn get_committed_total(env: Env, pvo_id: u32) -> i128 {
        let storage = env.storage().persistent();
        let pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_INDEX).unwrap_or_else(|| Map::new(&env));
        let grant_ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(&env));
        let grants: Map<u32, Grant> = storage.get(&GRANTS).unwrap_or_else(|| Map::new(&env));

        let mut total: i128 = 0;
        let mut i = 0u32;
        while i < grant_ids.len() {
            if let Some(id) = grant_ids.get(i) {
                if let Some(g) = grants.get(id) {
                    if g.status != GrantStatus::Cancelled {
                        total += g.amount;
                    }
                }
            }
            i += 1;
        }
        total
    }

    pub fn get_pvo_remaining(env: Env, pvo_id: u32) -> i128 {
        let storage = env.storage().persistent();
        let pvo_core_addr: Address = storage.get(&PVO_CORE).expect("not initialized");
        let budget: i128 = env.invoke_contract(
            &pvo_core_addr,
            &Symbol::new(&env, "get_pvo_budget"),
            soroban_sdk::vec![&env, pvo_id.into_val(&env)],
        );
        let committed = Self::get_committed_total(env.clone(), pvo_id);
        budget - committed
    }

    fn next_id(env: &Env) -> u32 {
        let mut count: u32 = env.storage().persistent().get(&COUNTER).unwrap_or(0);
        count += 1;
        env.storage().persistent().set(&COUNTER, &count);
        count
    }

    fn add_to_pvo_index(env: &Env, pvo_id: u32, grant_id: u32) {
        let storage = env.storage().persistent();
        let mut index: Map<u32, Vec<u32>> = storage.get(&PVO_INDEX).unwrap_or_else(|| Map::new(env));
        let mut ids = index.get(pvo_id).unwrap_or_else(|| Vec::new(env));
        ids.push_back(grant_id);
        index.set(pvo_id, ids);
        storage.set(&PVO_INDEX, &index);
    }

    fn add_to_donor_index(env: &Env, donor: &Address, grant_id: u32) {
        let storage = env.storage().persistent();
        let mut index: Map<Address, Vec<u32>> = storage.get(&DONOR_INDEX).unwrap_or_else(|| Map::new(env));
        let mut ids = index.get(donor.clone()).unwrap_or_else(|| Vec::new(env));
        ids.push_back(grant_id);
        index.set(donor.clone(), ids);
        storage.set(&DONOR_INDEX, &index);
    }
}

#[cfg(test)]
mod test;
