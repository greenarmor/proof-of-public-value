#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ComplianceRule {
    ProcurementLaw,
    COAregulation,
    EnvironmentalRegulation,
    BudgetDeviation,
    SafetyViolation,
    LaborCompliance,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ViolationRecord {
    pub id: u32,
    pub pvo_id: u32,
    pub rule: ComplianceRule,
    pub description: String,
    pub severity: u32,  // 0-100
    pub auto_paused: bool,
    pub reporter: Address,
    pub timestamp: u64,
    pub resolved: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ViolationDetectedEvent {
    pub id: u32,
    pub pvo_id: u32,
    pub severity: u32,
    pub auto_paused: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ViolationResolvedEvent {
    pub id: u32,
    pub pvo_id: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const VIOLATIONS: Symbol = symbol_short!("VIOLATNS");
const PVO_VIOLATIONS: Symbol = symbol_short!("PVOVIOL");
const COMPLIANCE_OFFICERS: Symbol = symbol_short!("COMPOFF");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct ComplianceEngine;

#[contractimpl]
impl ComplianceEngine {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn add_compliance_officer(env: Env, admin: Address, officer: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let mut officers: Map<Address, bool> = storage.get(&COMPLIANCE_OFFICERS).unwrap_or_else(|| Map::new(&env));
        officers.set(officer, true);
        storage.set(&COMPLIANCE_OFFICERS, &officers);
    }

    fn is_officer(env: &Env, officer: &Address) -> bool {
        let storage = env.storage().persistent();
        let officers: Map<Address, bool> = storage.get(&COMPLIANCE_OFFICERS).unwrap_or_else(|| Map::new(env));
        officers.get(officer.clone()).unwrap_or(false)
    }

    /// Report a compliance violation — auto-pauses if severity ≥ 70
    pub fn report_violation(
        env: Env,
        officer: Address,
        pvo_id: u32,
        rule: ComplianceRule,
        description: String,
        severity: u32,
    ) -> u32 {
        officer.require_auth();
        assert!(Self::is_officer(&env, &officer), "only compliance officers");

        let auto_paused = severity >= 70;
        let id = Self::next_id(&env);

        let record = ViolationRecord {
            id,
            pvo_id,
            rule,
            description,
            severity: severity.min(100),
            auto_paused,
            reporter: officer.clone(),
            timestamp: env.ledger().timestamp(),
            resolved: false,
        };

        let storage = env.storage().persistent();
        let mut violations: Map<u32, ViolationRecord> = storage.get(&VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        violations.set(id, record);
        storage.set(&VIOLATIONS, &violations);

        let mut pvo_idx: Map<u32, Vec<u32>> = storage.get(&PVO_VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        let mut ids = pvo_idx.get(pvo_id).unwrap_or_else(|| Vec::new(&env));
        ids.push_back(id);
        pvo_idx.set(pvo_id, ids);
        storage.set(&PVO_VIOLATIONS, &pvo_idx);

        ViolationDetectedEvent { id, pvo_id, severity, auto_paused }.publish(&env);
        id
    }

    /// Mark a violation as resolved
    pub fn resolve_violation(env: Env, officer: Address, violation_id: u32) {
        officer.require_auth();
        assert!(Self::is_officer(&env, &officer), "only compliance officers");

        let storage = env.storage().persistent();
        let mut violations: Map<u32, ViolationRecord> = storage.get(&VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        let mut record = violations.get(violation_id).expect("violation not found");

        record.resolved = true;
        violations.set(violation_id, record);
        storage.set(&VIOLATIONS, &violations);

        ViolationResolvedEvent { id: violation_id, pvo_id: 0 }.publish(&env);
    }

    // ─── Queries ───

    pub fn get_violation(env: Env, id: u32) -> Option<ViolationRecord> {
        let storage = env.storage().persistent();
        let violations: Map<u32, ViolationRecord> = storage.get(&VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        violations.get(id)
    }

    pub fn get_violations_by_pvo(env: Env, pvo_id: u32) -> Vec<ViolationRecord> {
        let storage = env.storage().persistent();
        let violations: Map<u32, ViolationRecord> = storage.get(&VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        let idx: Map<u32, Vec<u32>> = storage.get(&PVO_VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        let ids = idx.get(pvo_id).unwrap_or_else(|| Vec::new(&env));

        let mut result: Vec<ViolationRecord> = Vec::new(&env);
        for i in 0..ids.len() {
            if let Some(id) = ids.get(i) {
                if let Some(v) = violations.get(id) {
                    result.push_back(v);
                }
            }
        }
        result
    }

    pub fn get_active_violations(env: Env) -> Vec<ViolationRecord> {
        let storage = env.storage().persistent();
        let violations: Map<u32, ViolationRecord> = storage.get(&VIOLATIONS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<ViolationRecord> = Vec::new(&env);
        for (_, v) in violations.iter() {
            if !v.resolved {
                result.push_back(v);
            }
        }
        result
    }

    pub fn is_pvo_compliant(env: Env, pvo_id: u32) -> bool {
        let violations = Self::get_violations_by_pvo(env, pvo_id);
        for i in 0..violations.len() {
            if let Some(v) = violations.get(i) {
                if v.auto_paused && !v.resolved {
                    return false;
                }
            }
        }
        true
    }

    pub fn get_violation_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let violations: Map<u32, ViolationRecord> = storage.get(&VIOLATIONS).unwrap_or_else(|| Map::new(&env));
        violations.len() as u32
    }

    fn next_id(env: &Env) -> u32 {
        let storage = env.storage().persistent();
        let mut id: u32 = storage.get(&COUNTER).unwrap_or(0);
        id = id.saturating_add(1);
        storage.set(&COUNTER, &id);
        id
    }
}

mod test;
