#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DecisionCategory {
    Approval,
    Payment,
    EvidenceReview,
    ComplianceCheck,
    AIRiskAssessment,
    ProcurementAward,
    ContractModification,
    DisputeResolution,
    MilestoneRelease,
    RoleChange,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditEntry {
    pub id: u32,
    pub pvo_id: u32,
    pub category: DecisionCategory,
    pub actor: Address,
    pub actor_role: String,
    pub action: String,
    pub rationale: String,
    pub supporting_doc_hash: String,
    pub ai_recommendation: String,
    pub risk_score: u32,
    pub compliance_result: String,
    pub signature_hash: String,
    pub timestamp: u64,
    pub block_height: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuditEntryCreatedEvent {
    pub id: u32,
    pub pvo_id: u32,
    pub category: DecisionCategory,
    pub actor: Address,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const ENTRIES: Symbol = symbol_short!("ENTRIES");
const PVO_ENTRIES: Symbol = symbol_short!("PVO_ENT");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct AuditTrail;

#[contractimpl]
impl AuditTrail {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn record_decision(
        env: Env,
        actor: Address,
        pvo_id: u32,
        category: DecisionCategory,
        action: String,
        rationale: String,
        supporting_doc_hash: String,
        ai_recommendation: String,
        risk_score: u32,
        compliance_result: String,
        signature_hash: String,
    ) -> u32 {
        actor.require_auth();

        let id = Self::next_id(&env);
        let entry = AuditEntry {
            id,
            pvo_id,
            category: category.clone(),
            actor: actor.clone(),
            actor_role: String::from_str(&env, ""),
            action,
            rationale,
            supporting_doc_hash,
            ai_recommendation,
            risk_score,
            compliance_result,
            signature_hash,
            timestamp: env.ledger().timestamp(),
            block_height: env.ledger().sequence(),
        };

        let storage = env.storage().persistent();
        let mut entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));
        entries.set(id, entry);
        storage.set(&ENTRIES, &entries);

        Self::add_to_pvo_index(&env, pvo_id, id);

        AuditEntryCreatedEvent { id, pvo_id, category, actor }.publish(&env);

        id
    }

    pub fn record_decision_with_role(
        env: Env,
        actor: Address,
        actor_role: String,
        pvo_id: u32,
        category: DecisionCategory,
        action: String,
        rationale: String,
        supporting_doc_hash: String,
        ai_recommendation: String,
        risk_score: u32,
        compliance_result: String,
        signature_hash: String,
    ) -> u32 {
        actor.require_auth();

        let id = Self::next_id(&env);
        let entry = AuditEntry {
            id,
            pvo_id,
            category: category.clone(),
            actor: actor.clone(),
            actor_role,
            action,
            rationale,
            supporting_doc_hash,
            ai_recommendation,
            risk_score,
            compliance_result,
            signature_hash,
            timestamp: env.ledger().timestamp(),
            block_height: env.ledger().sequence(),
        };

        let storage = env.storage().persistent();
        let mut entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));
        entries.set(id, entry);
        storage.set(&ENTRIES, &entries);

        Self::add_to_pvo_index(&env, pvo_id, id);

        AuditEntryCreatedEvent { id, pvo_id, category, actor }.publish(&env);

        id
    }

    pub fn get_entry(env: Env, entry_id: u32) -> Option<AuditEntry> {
        let storage = env.storage().persistent();
        let entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));
        entries.get(entry_id)
    }

    pub fn get_pvo_audit_history(env: Env, pvo_id: u32) -> Vec<AuditEntry> {
        let storage = env.storage().persistent();
        let entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));
        let pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_ENTRIES).unwrap_or_else(|| Map::new(&env));
        let pvo_entry_ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(&env));

        let mut result: Vec<AuditEntry> = Vec::new(&env);
        for i in 0..pvo_entry_ids.len() {
            if let Some(eid) = pvo_entry_ids.get(i) {
                if let Some(entry) = entries.get(eid) {
                    result.push_back(entry);
                }
            }
        }
        result
    }

    pub fn get_entries_by_actor(env: Env, actor: Address) -> Vec<AuditEntry> {
        let storage = env.storage().persistent();
        let entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<AuditEntry> = Vec::new(&env);
        for (_, entry) in entries.iter() {
            if entry.actor == actor {
                result.push_back(entry);
            }
        }
        result
    }

    pub fn get_entries_by_category(env: Env, category: DecisionCategory) -> Vec<AuditEntry> {
        let storage = env.storage().persistent();
        let entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<AuditEntry> = Vec::new(&env);
        for (_, entry) in entries.iter() {
            if entry.category == category {
                result.push_back(entry);
            }
        }
        result
    }

    pub fn get_high_risk_entries(env: Env, min_risk_score: u32) -> Vec<AuditEntry> {
        let storage = env.storage().persistent();
        let entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<AuditEntry> = Vec::new(&env);
        for (_, entry) in entries.iter() {
            if entry.risk_score >= min_risk_score {
                result.push_back(entry);
            }
        }
        result
    }

    pub fn get_entry_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let entries: Map<u32, AuditEntry> = storage.get(&ENTRIES).unwrap_or_else(|| Map::new(&env));
        entries.len() as u32
    }

    pub fn get_pvo_entry_count(env: Env, pvo_id: u32) -> u32 {
        let storage = env.storage().persistent();
        let pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_ENTRIES).unwrap_or_else(|| Map::new(&env));
        pvo_index.get(pvo_id).map(|v| v.len() as u32).unwrap_or(0)
    }

    fn add_to_pvo_index(env: &Env, pvo_id: u32, entry_id: u32) {
        let storage = env.storage().persistent();
        let mut pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_ENTRIES).unwrap_or_else(|| Map::new(&env));
        let mut ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(env));
        ids.push_back(entry_id);
        pvo_index.set(pvo_id, ids);
        storage.set(&PVO_ENTRIES, &pvo_index);
    }

    fn next_id(env: &Env) -> u32 {
        let storage = env.storage().persistent();
        let mut id: u32 = storage.get(&COUNTER).unwrap_or(0);
        id += 1;
        storage.set(&COUNTER, &id);
        id
    }
}

mod test;
