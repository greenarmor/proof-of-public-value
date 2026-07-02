#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ScoreCategory {
    EngineeringQuality,
    BudgetEfficiency,
    SchedulePerformance,
    EnvironmentalImpact,
    Safety,
    FloodReduction,
    CitizenSatisfaction,
    Transparency,
    Compliance,
    MaintenanceReadiness,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CategoryScore {
    pub category: ScoreCategory,
    pub score: u32,
    pub weight: u32,
    pub evaluator: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PVOScore {
    pub pvo_id: u32,
    pub overall_score: u32,
    pub category_scores: Vec<CategoryScore>,
    pub last_updated: u64,
    pub total_evaluations: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IndexEntry {
    pub department: String,
    pub avg_score: u32,
    pub pvo_count: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScoreUpdatedEvent {
    pub pvo_id: u32,
    pub overall_score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IndexUpdatedEvent {
    pub department: String,
    pub avg_score: u32,
}

const SCORES: Symbol = symbol_short!("SCORES");
const DEPT_INDEX: Symbol = symbol_short!("DEPT_IDX");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct ValueScore;

#[contractimpl]
impl ValueScore {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&INITIALIZED, &true);
    }

    pub fn submit_score(
        env: Env,
        evaluator: Address,
        pvo_id: u32,
        category: ScoreCategory,
        score: u32,
        weight: u32,
    ) {
        evaluator.require_auth();

        if score > 100 {
            panic!("score must be 0-100");
        }
        if weight > 100 {
            panic!("weight must be 0-100");
        }

        let now = env.ledger().timestamp();
        let category_score = CategoryScore {
            category: category.clone(),
            score,
            weight,
            evaluator,
            timestamp: now,
        };

        let storage = env.storage().persistent();
        let mut scores: Map<u32, PVOScore> = storage.get(&SCORES).unwrap_or_else(|| Map::new(&env));

        let mut pvo_score = scores.get(pvo_id).unwrap_or(PVOScore {
            pvo_id,
            overall_score: 0,
            category_scores: Vec::new(&env),
            last_updated: now,
            total_evaluations: 0,
        });

        let mut updated = false;
        for i in 0..pvo_score.category_scores.len() {
            if let Some(mut cs) = pvo_score.category_scores.get(i) {
                if cs.category == category {
                    cs.score = score;
                    cs.weight = weight;
                    cs.timestamp = now;
                    pvo_score.category_scores.set(i, cs);
                    updated = true;
                    break;
                }
            }
        }

        if !updated {
            pvo_score.category_scores.push_back(category_score);
        }

        pvo_score.total_evaluations = pvo_score.total_evaluations.saturating_add(1);
        pvo_score.overall_score = Self::calculate_weighted_score(&pvo_score);
        pvo_score.last_updated = now;

        let overall = pvo_score.overall_score;
        scores.set(pvo_id, pvo_score);
        storage.set(&SCORES, &scores);

        ScoreUpdatedEvent { pvo_id, overall_score: overall }.publish(&env);
    }

    pub fn get_score(env: Env, pvo_id: u32) -> Option<PVOScore> {
        let storage = env.storage().persistent();
        let scores: Map<u32, PVOScore> = storage.get(&SCORES).unwrap_or_else(|| Map::new(&env));
        scores.get(pvo_id)
    }

    pub fn get_overall_score(env: Env, pvo_id: u32) -> u32 {
        Self::get_score(env, pvo_id).map(|s| s.overall_score).unwrap_or(0)
    }

    pub fn get_category_score(env: Env, pvo_id: u32, category: ScoreCategory) -> Option<CategoryScore> {
        let storage = env.storage().persistent();
        let scores: Map<u32, PVOScore> = storage.get(&SCORES).unwrap_or_else(|| Map::new(&env));
        let pvo_score = scores.get(pvo_id)?;

        for i in 0..pvo_score.category_scores.len() {
            if let Some(cs) = pvo_score.category_scores.get(i) {
                if cs.category == category {
                    return Some(cs);
                }
            }
        }
        None
    }

    pub fn calculate_weighted_score(pvo_score: &PVOScore) -> u32 {
        if pvo_score.category_scores.is_empty() {
            return 0;
        }

        let mut total_weighted: u64 = 0;
        let mut total_weight: u64 = 0;

        for i in 0..pvo_score.category_scores.len() {
            if let Some(cs) = pvo_score.category_scores.get(i) {
                total_weighted += (cs.score as u64) * (cs.weight as u64);
                total_weight += cs.weight as u64;
            }
        }

        if total_weight == 0 {
            return 0;
        }

        (total_weighted / total_weight) as u32
    }

    pub fn update_department_index(env: Env, caller: Address, department: String, pvo_id: u32) {
        caller.require_auth();
        let storage = env.storage().persistent();
        let scores: Map<u32, PVOScore> = storage.get(&SCORES).unwrap_or_else(|| Map::new(&env));
        let pvo_score = match scores.get(pvo_id) {
            Some(s) => s,
            None => return,
        };

        let mut dept_index: Map<String, IndexEntry> = storage.get(&DEPT_INDEX).unwrap_or_else(|| Map::new(&env));

        let mut entry = dept_index.get(department.clone()).unwrap_or(IndexEntry {
            department: department.clone(),
            avg_score: 0,
            pvo_count: 0,
        });

        let old_total = (entry.avg_score as u64) * (entry.pvo_count as u64);
        let new_count = entry.pvo_count + 1;
        entry.avg_score = ((old_total + pvo_score.overall_score as u64) / new_count as u64) as u32;
        entry.pvo_count = entry.pvo_count.saturating_add(1);

        let avg = entry.avg_score;
        dept_index.set(department.clone(), entry);
        storage.set(&DEPT_INDEX, &dept_index);

        IndexUpdatedEvent { department, avg_score: avg }.publish(&env);
    }

    pub fn get_department_index(env: Env, department: String) -> Option<IndexEntry> {
        let storage = env.storage().persistent();
        let dept_index: Map<String, IndexEntry> = storage.get(&DEPT_INDEX).unwrap_or_else(|| Map::new(&env));
        dept_index.get(department)
    }

    pub fn get_all_department_indices(env: Env) -> Vec<IndexEntry> {
        let storage = env.storage().persistent();
        let dept_index: Map<String, IndexEntry> = storage.get(&DEPT_INDEX).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<IndexEntry> = Vec::new(&env);
        for (_, entry) in dept_index.iter() {
            result.push_back(entry);
        }
        result
    }

    pub fn get_top_departments(env: Env, count: u32) -> Vec<IndexEntry> {
        let all = Self::get_all_department_indices(env.clone());

        let mut sorted: Vec<IndexEntry> = all.clone();
        let mut n = sorted.len();
        for i in 0..n {
            for j in 0..n.saturating_sub(1).saturating_sub(i) {
                let a = sorted.get(j).unwrap();
                let b = sorted.get(j + 1).unwrap();
                if a.avg_score < b.avg_score {
                    sorted.set(j, b.clone());
                    sorted.set(j + 1, a);
                }
            }
            n = sorted.len();
            if i >= count {
                break;
            }
        }

        let mut result: Vec<IndexEntry> = Vec::new(&sorted.env());
        let limit = if count < sorted.len() { count } else { sorted.len() };
        for i in 0..limit {
            if let Some(entry) = sorted.get(i) {
                result.push_back(entry);
            }
        }
        result
    }

    pub fn get_scored_pvo_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let scores: Map<u32, PVOScore> = storage.get(&SCORES).unwrap_or_else(|| Map::new(&env));
        scores.len() as u32
    }
}

mod test;
