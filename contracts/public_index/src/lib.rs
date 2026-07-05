#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepartmentBenchmark {
    pub department: String,
    pub avg_value_score: u32,
    pub pvo_count: u32,
    pub total_budget: i128,
    pub completed_projects: u32,
    pub on_time_rate: u32,
    pub rank: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NationalSnapshot {
    pub timestamp: u64,
    pub total_pvos: u32,
    pub total_budget: i128,
    pub avg_value_score: u32,
    pub departments_ranked: u32,
    pub top_dept: String,
    pub top_dept_score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SnapshotRecordedEvent {
    pub total_pvos: u32,
    pub avg_value_score: u32,
    pub top_dept: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BenchmarkUpdatedEvent {
    pub department: String,
    pub rank: u32,
    pub avg_value_score: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const BENCHMARKS: Symbol = symbol_short!("BENCHMRK");
const SNAPSHOTS: Symbol = symbol_short!("SNAPSHOT");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct PublicIndex;

#[contractimpl]
impl PublicIndex {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    /// Submit department benchmark data from value_score calculations
    pub fn update_department_benchmark(
        env: Env,
        department: String,
        avg_value_score: u32,
        pvo_count: u32,
        total_budget: i128,
        completed_projects: u32,
        on_time_rate: u32,
    ) {

        let storage = env.storage().persistent();
        let mut benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(&env));

        let rank = Self::compute_rank(&env, avg_value_score);

        let benchmark = DepartmentBenchmark {
            department: department.clone(),
            avg_value_score,
            pvo_count,
            total_budget,
            completed_projects,
            on_time_rate,
            rank,
        };

        benchmarks.set(department.clone(), benchmark);
        storage.set(&BENCHMARKS, &benchmarks);

        Self::rebalance_ranks(&env);

        BenchmarkUpdatedEvent { department, rank, avg_value_score }.publish(&env);
    }

    /// Take a snapshot of the national public value index
    pub fn record_national_snapshot(env: Env) -> u32 {

        let storage = env.storage().persistent();
        let benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(&env));

        let mut total_pvos = 0u32;
        let mut total_budget: i128 = 0;
        let mut total_score = 0u32;
        let mut dept_count = 0u32;
        let mut top_score = 0u32;
        let mut top_dept = String::from_str(&env, "");

        for (_, b) in benchmarks.iter() {
            total_pvos = total_pvos.saturating_add(b.pvo_count);
            total_budget = total_budget.saturating_add(b.total_budget);
            total_score = total_score.saturating_add(b.avg_value_score);
            dept_count = dept_count.saturating_add(1);

            if b.avg_value_score > top_score {
                top_score = b.avg_value_score;
                top_dept = b.department.clone();
            }
        }

        let avg_value_score = if dept_count > 0 { total_score / dept_count } else { 0 };

        let id = Self::next_id(&env);
        let snapshot = NationalSnapshot {
            timestamp: env.ledger().timestamp(),
            total_pvos,
            total_budget,
            avg_value_score,
            departments_ranked: dept_count,
            top_dept: top_dept.clone(),
            top_dept_score: top_score,
        };

        let mut snapshots: Map<u32, NationalSnapshot> = storage.get(&SNAPSHOTS).unwrap_or_else(|| Map::new(&env));
        snapshots.set(id, snapshot);
        storage.set(&SNAPSHOTS, &snapshots);

        SnapshotRecordedEvent { total_pvos, avg_value_score, top_dept }.publish(&env);
        id
    }

    // ─── Queries ───

    pub fn get_benchmark(env: Env, department: String) -> Option<DepartmentBenchmark> {
        let storage = env.storage().persistent();
        let benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(&env));
        benchmarks.get(department)
    }

    pub fn get_all_benchmarks(env: Env) -> Vec<DepartmentBenchmark> {
        let storage = env.storage().persistent();
        let benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<DepartmentBenchmark> = Vec::new(&env);
        for (_, b) in benchmarks.iter() {
            result.push_back(b);
        }
        result
    }

    pub fn get_top_departments(env: Env, count: u32) -> Vec<DepartmentBenchmark> {
        let all = Self::get_all_benchmarks(env.clone());
        let limit = if count < all.len() { count } else { all.len() };

        let mut result: Vec<DepartmentBenchmark> = Vec::new(&env);
        for i in 0..limit {
            if let Some(b) = all.get(i) {
                result.push_back(b);
            }
        }
        result
    }

    pub fn get_latest_snapshot(env: Env) -> Option<NationalSnapshot> {
        let storage = env.storage().persistent();
        let snapshots: Map<u32, NationalSnapshot> = storage.get(&SNAPSHOTS).unwrap_or_else(|| Map::new(&env));
        let mut latest: Option<NationalSnapshot> = None;
        for (_, s) in snapshots.iter() {
            match &latest {
                None => latest = Some(s),
                Some(l) if s.timestamp > l.timestamp => latest = Some(s),
                _ => {}
            }
        }
        latest
    }

    pub fn get_snapshot_history(env: Env) -> Vec<NationalSnapshot> {
        let storage = env.storage().persistent();
        let snapshots: Map<u32, NationalSnapshot> = storage.get(&SNAPSHOTS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<NationalSnapshot> = Vec::new(&env);
        for (_, s) in snapshots.iter() {
            result.push_back(s);
        }
        result
    }

    pub fn get_department_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(&env));
        benchmarks.len() as u32
    }

    // ─── Helpers ───

    fn compute_rank(env: &Env, score: u32) -> u32 {
        let storage = env.storage().persistent();
        let benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(env));

        let mut better_count = 0u32;
        for (_, b) in benchmarks.iter() {
            if b.avg_value_score > score {
                better_count = better_count.saturating_add(1);
            }
        }
        better_count.saturating_add(1)
    }

    fn rebalance_ranks(env: &Env) {
        let storage = env.storage().persistent();
        let mut benchmarks: Map<String, DepartmentBenchmark> = storage.get(&BENCHMARKS).unwrap_or_else(|| Map::new(env));

        let mut entries: Vec<(String, DepartmentBenchmark)> = Vec::new(env);
        for (dept, b) in benchmarks.iter() {
            entries.push_back((dept, b));
        }

        // Bubble sort by avg_value_score descending
        let n = entries.len();
        for i in 0..n {
            for j in 0..n.saturating_sub(1).saturating_sub(i) {
                let a = entries.get(j).expect("index bounds");
                let b = entries.get(j.saturating_add(1)).expect("index bounds");
                if a.1.avg_value_score < b.1.avg_value_score {
                    entries.set(j, b);
                    entries.set(j.saturating_add(1), a);
                }
            }
        }

        for i in 0..n {
            if let Some((dept, mut b)) = entries.get(i) {
                b.rank = i.saturating_add(1) as u32;
                benchmarks.set(dept, b);
            }
        }

        storage.set(&BENCHMARKS, &benchmarks);
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
