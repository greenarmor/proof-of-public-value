#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EntityType {
    GovernmentAgency,
    Municipality,
    Contractor,
    Engineer,
    Inspector,
    Supplier,
    Consultant,
    Auditor,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReputationRecord {
    pub id: u32,
    pub entity: Address,
    pub entity_type: EntityType,
    pub completed_projects: u32,
    pub delayed_projects: u32,
    pub budget_overruns: u32,
    pub audit_findings: u32,
    pub legal_cases: u32,
    pub community_complaints: u32,
    pub safety_violations: u32,
    pub average_value_score: u32,
    pub success_rate: u32,
    pub reputation_score: u32,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplaintRecord {
    pub id: u32,
    pub entity: Address,
    pub complainant: Address,
    pub category: String,
    pub description: String,
    pub severity: u32,
    pub verified: bool,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReputationUpdatedEvent {
    pub entity: Address,
    pub reputation_score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplaintFiledEvent {
    pub entity: Address,
    pub complainant: Address,
    pub severity: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EntityRegisteredEvent {
    pub entity: Address,
    pub entity_type: EntityType,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplaintVerifiedEvent {
    pub complaint_id: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const REPUTATIONS: Symbol = symbol_short!("REPUTAT");
const COMPLAINTS: Symbol = symbol_short!("COMPLAIN");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct ReputationLedger;

#[contractimpl]
impl ReputationLedger {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn register_entity(env: Env, entity: Address, entity_type: EntityType) {
        entity.require_auth();

        let storage = env.storage().persistent();
        let mut reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));

        if reputations.get(entity.clone()).is_some() {
            panic!("entity already registered");
        }

        let record = ReputationRecord {
            id: Self::next_id(&env),
            entity: entity.clone(),
            entity_type: entity_type.clone(),
            completed_projects: 0,
            delayed_projects: 0,
            budget_overruns: 0,
            audit_findings: 0,
            legal_cases: 0,
            community_complaints: 0,
            safety_violations: 0,
            average_value_score: 0,
            success_rate: 100,
            reputation_score: 100,
            last_updated: env.ledger().timestamp(),
        };

        reputations.set(entity.clone(), record);
        storage.set(&REPUTATIONS, &reputations);

        EntityRegisteredEvent { entity: entity.clone(), entity_type }.publish(&env);
    }

    pub fn record_completion(env: Env, caller: Address, entity: Address, value_score: u32, on_time: bool, within_budget: bool) {
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));
        let mut record = reputations.get(entity.clone()).expect("entity not registered");

        record.completed_projects = record.completed_projects.saturating_add(1);
        if !on_time {
            record.delayed_projects = record.delayed_projects.saturating_add(1);
        }
        if !within_budget {
            record.budget_overruns = record.budget_overruns.saturating_add(1);
        }

        let total = record.completed_projects;
        let on_time_count = total.saturating_sub(record.delayed_projects);
        record.success_rate = if total > 0 { on_time_count.saturating_mul(100) / total } else { 100 };

        let prev_total = record.completed_projects.saturating_sub(1);
        if prev_total > 0 {
            record.average_value_score = (record.average_value_score.saturating_mul(prev_total).saturating_add(value_score)) / total;
        } else {
            record.average_value_score = value_score;
        }

        record.reputation_score = Self::calculate_reputation(&record);
        record.last_updated = env.ledger().timestamp();

        reputations.set(entity.clone(), record);
        storage.set(&REPUTATIONS, &reputations);

        ReputationUpdatedEvent { entity, reputation_score: 0 }.publish(&env);
    }

    pub fn record_audit_finding(env: Env, caller: Address, entity: Address, severity: u32) {
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));
        let mut record = reputations.get(entity.clone()).expect("entity not registered");

        record.audit_findings = record.audit_findings.saturating_add(1);
        record.reputation_score = record.reputation_score.saturating_sub(severity.saturating_mul(5));
        record.last_updated = env.ledger().timestamp();

        reputations.set(entity.clone(), record);
        storage.set(&REPUTATIONS, &reputations);

        ReputationUpdatedEvent { entity, reputation_score: 0 }.publish(&env);
    }

    pub fn record_safety_violation(env: Env, caller: Address, entity: Address, severity: u32) {
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));
        let mut record = reputations.get(entity.clone()).expect("entity not registered");

        record.safety_violations = record.safety_violations.saturating_add(1);
        record.reputation_score = record.reputation_score.saturating_sub(severity.saturating_mul(10));
        record.last_updated = env.ledger().timestamp();

        reputations.set(entity.clone(), record.clone());
        storage.set(&REPUTATIONS, &reputations);

        ReputationUpdatedEvent { entity, reputation_score: record.reputation_score }.publish(&env);
    }

    pub fn file_complaint(
        env: Env,
        complainant: Address,
        entity: Address,
        category: String,
        description: String,
        severity: u32,
    ) -> u32 {
        complainant.require_auth();

        let id = Self::next_id(&env);
        let complaint = ComplaintRecord {
            id,
            entity: entity.clone(),
            complainant: complainant.clone(),
            category,
            description,
            severity,
            verified: false,
            timestamp: env.ledger().timestamp(),
        };

        let storage = env.storage().persistent();
        let mut complaints: Map<u32, ComplaintRecord> = storage.get(&COMPLAINTS).unwrap_or_else(|| Map::new(&env));
        complaints.set(id, complaint);
        storage.set(&COMPLAINTS, &complaints);

        let mut reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));
        let mut record = reputations.get(entity.clone()).expect("entity not registered");
        record.community_complaints = record.community_complaints.saturating_add(1);
        record.reputation_score = record.reputation_score.saturating_sub(severity);
        record.last_updated = env.ledger().timestamp();
        reputations.set(entity.clone(), record);
        storage.set(&REPUTATIONS, &reputations);

        ComplaintFiledEvent { entity, complainant, severity }.publish(&env);

        id
    }

    pub fn verify_complaint(env: Env, caller: Address, complaint_id: u32) {
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut complaints: Map<u32, ComplaintRecord> = storage.get(&COMPLAINTS).unwrap_or_else(|| Map::new(&env));
        let mut complaint = complaints.get(complaint_id).expect("complaint not found");

        complaint.verified = true;
        complaints.set(complaint_id, complaint);
        storage.set(&COMPLAINTS, &complaints);

        ComplaintVerifiedEvent { complaint_id }.publish(&env);
    }

    pub fn get_reputation(env: Env, entity: Address) -> Option<ReputationRecord> {
        let storage = env.storage().persistent();
        let reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));
        reputations.get(entity)
    }

    pub fn get_complaint(env: Env, complaint_id: u32) -> Option<ComplaintRecord> {
        let storage = env.storage().persistent();
        let complaints: Map<u32, ComplaintRecord> = storage.get(&COMPLAINTS).unwrap_or_else(|| Map::new(&env));
        complaints.get(complaint_id)
    }

    pub fn get_complaints_by_entity(env: Env, entity: Address) -> Vec<ComplaintRecord> {
        let storage = env.storage().persistent();
        let complaints: Map<u32, ComplaintRecord> = storage.get(&COMPLAINTS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<ComplaintRecord> = Vec::new(&env);
        for (_, complaint) in complaints.iter() {
            if complaint.entity == entity {
                result.push_back(complaint);
            }
        }
        result
    }

    pub fn get_entities_by_reputation(env: Env, entity_type: EntityType, min_score: u32) -> Vec<Address> {
        let storage = env.storage().persistent();
        let reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<Address> = Vec::new(&env);
        for (addr, record) in reputations.iter() {
            if record.entity_type == entity_type && record.reputation_score >= min_score {
                result.push_back(addr);
            }
        }
        result
    }

    pub fn get_entity_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let reputations: Map<Address, ReputationRecord> = storage.get(&REPUTATIONS).unwrap_or_else(|| Map::new(&env));
        reputations.len() as u32
    }

    fn calculate_reputation(record: &ReputationRecord) -> u32 {
        let base: i32 = 100;

        let penalties: i32 = (record.delayed_projects as i32) * 5
            + (record.budget_overruns as i32) * 5
            + (record.audit_findings as i32) * 10
            + (record.safety_violations as i32) * 15
            + (record.community_complaints as i32) * 2;

        let recovery: i32 = ((record.success_rate as i32) + (record.average_value_score as i32)) / 40;
        let recovery = recovery.min(5);

        let score = base - penalties + recovery;

        if score < 0 { 0 } else if score > 100 { 100 } else { score as u32 }
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
