#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, token, Address, Env, Map, String, Symbol, Vec};

const RPT_ASSET: &str = "CCZCWNF4N7ZAZT4GWEWNW44LIOAEWILB56GUIA6BJZ3BYJKTHTEJFCAQ";

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReportType {
    GpsPhoto,
    GpsVideo,
    FloodReport,
    CompletionVerification,
    QualityReport,
    DamageReport,
    UsageReport,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunityReport {
    pub id: u32,
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub citizen: Address,
    pub report_type: ReportType,
    pub data_hash: String,
    pub gps_lat: i128,
    pub gps_lon: i128,
    pub timestamp: u64,
    pub confidence_score: u32,
    pub verified: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CitizenReputation {
    pub address: Address,
    pub total_reports: u32,
    pub verified_reports: u32,
    pub confidence_rating: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReportSubmittedEvent {
    pub id: u32,
    pub pvo_id: u32,
    pub citizen: Address,
    pub report_type: ReportType,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReportVerifiedEvent {
    pub id: u32,
    pub confidence_score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfidenceCalculatedEvent {
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub confidence: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const REPORTS: Symbol = symbol_short!("REPORTS");
const CITIZEN_REP: Symbol = symbol_short!("CITIZEN_R");
const PVO_INDEX: Symbol = symbol_short!("PVO_IDX");
const INITIALIZED: Symbol = symbol_short!("INIT");
const MIN_BALANCE: Symbol = symbol_short!("MINBAL");

#[contract]
pub struct CommunityOracle;

#[contractimpl]
impl CommunityOracle {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn set_citizen_credential(env: Env, admin: Address, min_balance: i128) {
        admin.require_auth();
        let storage = env.storage().persistent();
        storage.set(&MIN_BALANCE, &min_balance);
    }

    pub fn submit_report(
        env: Env,
        citizen: Address,
        pvo_id: u32,
        milestone_id: u32,
        report_type: ReportType,
        data_hash: String,
        gps_lat: i128,
        gps_lon: i128,
    ) -> u32 {
        citizen.require_auth();

        let storage = env.storage().persistent();
        let min_balance: i128 = storage.get(&MIN_BALANCE).unwrap_or(0);

        if min_balance > 0 {
            let rpt = token::Client::new(&env, &Address::from_string(&String::from_str(&env, RPT_ASSET)));
            let balance = rpt.balance(&citizen);
            assert!(balance >= min_balance, "insufficient RPT balance to report");
        }

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();

        let report = CommunityReport {
            id,
            pvo_id,
            milestone_id,
            citizen: citizen.clone(),
            report_type: report_type.clone(),
            data_hash,
            gps_lat,
            gps_lon,
            timestamp: now,
            confidence_score: 0,
            verified: false,
        };

        let storage = env.storage().persistent();

        let mut reports: Map<u32, CommunityReport> = storage.get(&REPORTS).unwrap_or_else(|| Map::new(&env));
        reports.set(id, report);
        storage.set(&REPORTS, &reports);

        Self::add_to_pvo_index(&env, pvo_id, id);

        let mut citizen_rep: Map<Address, CitizenReputation> = storage.get(&CITIZEN_REP).unwrap_or_else(|| Map::new(&env));
        let mut rep = citizen_rep.get(citizen.clone()).unwrap_or(CitizenReputation {
            address: citizen.clone(),
            total_reports: 0,
            verified_reports: 0,
            confidence_rating: 50,
        });
        rep.total_reports = rep.total_reports.saturating_add(1);
        citizen_rep.set(citizen.clone(), rep);
        storage.set(&CITIZEN_REP, &citizen_rep);

        ReportSubmittedEvent { id, pvo_id, citizen, report_type }.publish(&env);

        id
    }

    pub fn calculate_confidence(env: Env, caller: Address, pvo_id: u32, milestone_id: u32) -> u32 {
        caller.require_auth();
        let storage = env.storage().persistent();
        let mut reports: Map<u32, CommunityReport> = storage.get(&REPORTS).unwrap_or_else(|| Map::new(&env));

        let pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_INDEX).unwrap_or_else(|| Map::new(&env));
        let pvo_report_ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(&env));

        let mut matching: Vec<u32> = Vec::new(&env);
        for i in 0..pvo_report_ids.len() {
            if let Some(rid) = pvo_report_ids.get(i) {
                if let Some(report) = reports.get(rid) {
                    if report.milestone_id == milestone_id {
                        matching.push_back(rid);
                    }
                }
            }
        }

        if matching.is_empty() {
            return 0;
        }

        let mut total_reports = 0u32;
        let mut verified_count = 0u32;
        let mut total_citizen_rating = 0u32;

        let citizen_rep: Map<Address, CitizenReputation> = storage.get(&CITIZEN_REP).unwrap_or_else(|| Map::new(&env));

        for i in 0..matching.len() {
            if let Some(rid) = matching.get(i) {
                if let Some(report) = reports.get(rid) {
                    total_reports = total_reports.saturating_add(1);
                    let rep = citizen_rep.get(report.citizen.clone()).unwrap_or(CitizenReputation {
                        address: report.citizen.clone(),
                        total_reports: 0,
                        verified_reports: 0,
                        confidence_rating: 50,
                    });
                    total_citizen_rating = total_citizen_rating.saturating_add(rep.confidence_rating);
                    if report.verified {
                        verified_count = verified_count.saturating_add(1);
                    }
                }
            }
        }

        if total_reports == 0 {
            return 0;
        }

        let avg_rating = total_citizen_rating / total_reports;
        let verification_ratio = verified_count.saturating_mul(100) / total_reports;
        let confidence = (avg_rating + verification_ratio) / 2;

        for i in 0..matching.len() {
            if let Some(rid) = matching.get(i) {
                if let Some(r) = reports.get(rid) {
                    let mut updated = r;
                    updated.confidence_score = confidence;
                    reports.set(rid, updated);
                }
            }
        }
        storage.set(&REPORTS, &reports);

        ConfidenceCalculatedEvent { pvo_id, milestone_id, confidence }.publish(&env);

        confidence
    }

    pub fn verify_report(env: Env, verifier: Address, report_id: u32, verifier_weight: u32) {
        verifier.require_auth();
        let storage = env.storage().persistent();
        let mut reports: Map<u32, CommunityReport> = storage.get(&REPORTS).unwrap_or_else(|| Map::new(&env));
        let mut report = reports.get(report_id).expect("report not found");

        report.verified = true;
        report.confidence_score = report.confidence_score.saturating_add(verifier_weight);
        let citizen = report.citizen.clone();
        let score = report.confidence_score;
        reports.set(report_id, report);
        storage.set(&REPORTS, &reports);

        let mut citizen_rep: Map<Address, CitizenReputation> = storage.get(&CITIZEN_REP).unwrap_or_else(|| Map::new(&env));
        let mut rep = citizen_rep.get(citizen.clone()).unwrap_or(CitizenReputation {
            address: citizen.clone(),
            total_reports: 0,
            verified_reports: 0,
            confidence_rating: 50,
        });
        rep.verified_reports = rep.verified_reports.saturating_add(1);
        rep.confidence_rating = rep.confidence_rating.saturating_add(verifier_weight).min(100);
        citizen_rep.set(citizen, rep);
        storage.set(&CITIZEN_REP, &citizen_rep);

        ReportVerifiedEvent { id: report_id, confidence_score: score }.publish(&env);
    }

    pub fn get_report(env: Env, report_id: u32) -> Option<CommunityReport> {
        let storage = env.storage().persistent();
        let reports: Map<u32, CommunityReport> = storage.get(&REPORTS).unwrap_or_else(|| Map::new(&env));
        reports.get(report_id)
    }

    pub fn get_reports_by_pvo(env: Env, pvo_id: u32) -> Vec<CommunityReport> {
        let storage = env.storage().persistent();
        let reports: Map<u32, CommunityReport> = storage.get(&REPORTS).unwrap_or_else(|| Map::new(&env));
        let pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_INDEX).unwrap_or_else(|| Map::new(&env));
        let pvo_report_ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(&env));

        let mut result: Vec<CommunityReport> = Vec::new(&env);
        for i in 0..pvo_report_ids.len() {
            if let Some(rid) = pvo_report_ids.get(i) {
                if let Some(report) = reports.get(rid) {
                    result.push_back(report);
                }
            }
        }
        result
    }

    pub fn get_citizen_reputation(env: Env, citizen: Address) -> Option<CitizenReputation> {
        let storage = env.storage().persistent();
        let citizen_rep: Map<Address, CitizenReputation> = storage.get(&CITIZEN_REP).unwrap_or_else(|| Map::new(&env));
        citizen_rep.get(citizen)
    }

    pub fn get_report_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let reports: Map<u32, CommunityReport> = storage.get(&REPORTS).unwrap_or_else(|| Map::new(&env));
        reports.len() as u32
    }

    fn add_to_pvo_index(env: &Env, pvo_id: u32, report_id: u32) {
        let storage = env.storage().persistent();
        let mut pvo_index: Map<u32, Vec<u32>> = storage.get(&PVO_INDEX).unwrap_or_else(|| Map::new(&env));
        let mut ids = pvo_index.get(pvo_id).unwrap_or_else(|| Vec::new(env));
        ids.push_back(report_id);
        pvo_index.set(pvo_id, ids);
        storage.set(&PVO_INDEX, &pvo_index);
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
