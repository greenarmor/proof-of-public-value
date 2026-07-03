#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum FraudIndicator {
    DuplicateInvoice,
    GhostProject,
    AbnormalBudgetGrowth,
    UnusualPaymentTiming,
    CollusionPattern,
    RepeatedContractorWin,
    MaterialCostInflation,
    ShellCompanyRisk,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FraudDetectionResult {
    pub id: u32,
    pub pvo_id: u32,
    pub risk_score: u32,
    pub indicators: Vec<FraudIndicator>,
    pub confidence: u32,
    pub auditor: Address,
    pub timestamp: u64,
    pub evidence_hash: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskPrediction {
    pub id: u32,
    pub contractor: Address,
    pub delay_probability: u32,
    pub overrun_probability: u32,
    pub risk_category: u32,  // 0=low, 1=medium, 2=high, 3=critical
    pub confidence: u32,
    pub auditor: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImageVerification {
    pub id: u32,
    pub evidence_id: u32,
    pub progress_percent: u32,
    pub authenticity_score: u32,
    pub summary: String,
    pub auditor: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DigitalTwin {
    pub pvo_id: u32,
    pub expected_cost: i128,
    pub material_cost_index: u32,
    pub labor_cost_index: u32,
    pub deviation_alert: bool,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GeoRiskAssessment {
    pub pvo_id: u32,
    pub region: String,
    pub flood_risk: u32,
    pub seismic_risk: u32,
    pub landslide_risk: u32,
    pub overall_risk_score: u32,
    pub auditor: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GpsValidation {
    pub id: u32,
    pub evidence_id: u32,
    pub expected_lat: i128,
    pub expected_lon: i128,
    pub reported_lat: i128,
    pub reported_lon: i128,
    pub distance_meters: u32,
    pub within_range: bool,
    pub auditor: Address,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FraudDetectedEvent {
    pub pvo_id: u32,
    pub risk_score: u32,
    pub auditor: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskPredictedEvent {
    pub contractor: Address,
    pub risk_category: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImageVerifiedEvent {
    pub evidence_id: u32,
    pub progress_percent: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DigitalTwinUpdatedEvent {
    pub pvo_id: u32,
    pub expected_cost: i128,
    pub deviation_alert: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GeoRiskAssessedEvent {
    pub pvo_id: u32,
    pub region: String,
    pub overall_risk_score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GpsValidatedEvent {
    pub evidence_id: u32,
    pub within_range: bool,
    pub distance_meters: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const FRAUD_RESULTS: Symbol = symbol_short!("FRAUDRES");
const RISK_PREDICTIONS: Symbol = symbol_short!("RISKPRED");
const IMAGE_VERIFICATIONS: Symbol = symbol_short!("IMGVERIF");
const DIGITAL_TWINS: Symbol = symbol_short!("DIGITWIN");
const AI_AUDITORS: Symbol = symbol_short!("AIAUDIT");
const PVO_FRAUD_IDX: Symbol = symbol_short!("PVOFRAUD");
const GEO_RISKS: Symbol = symbol_short!("GEORISKS");
const GPS_VALIDATIONS: Symbol = symbol_short!("GPSVAL");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct AIOracle;

#[contractimpl]
impl AIOracle {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn add_ai_auditor(env: Env, admin: Address, auditor: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let mut auditors: Map<Address, bool> = storage.get(&AI_AUDITORS).unwrap_or_else(|| Map::new(&env));
        auditors.set(auditor, true);
        storage.set(&AI_AUDITORS, &auditors);
    }

    pub fn remove_ai_auditor(env: Env, admin: Address, auditor: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let mut auditors: Map<Address, bool> = storage.get(&AI_AUDITORS).unwrap_or_else(|| Map::new(&env));
        auditors.remove(auditor);
        storage.set(&AI_AUDITORS, &auditors);
    }

    fn is_ai_auditor(env: &Env, auditor: &Address) -> bool {
        let storage = env.storage().persistent();
        let auditors: Map<Address, bool> = storage.get(&AI_AUDITORS).unwrap_or_else(|| Map::new(env));
        auditors.get(auditor.clone()).unwrap_or(false)
    }

    /// Submit a fraud detection result (AI auditor only)
    pub fn submit_fraud_detection(
        env: Env,
        auditor: Address,
        pvo_id: u32,
        risk_score: u32,
        indicators: Vec<FraudIndicator>,
        confidence: u32,
        evidence_hash: String,
    ) -> u32 {
        auditor.require_auth();
        assert!(Self::is_ai_auditor(&env, &auditor), "only AI auditors can submit");

        let id = Self::next_id(&env);
        let result = FraudDetectionResult {
            id,
            pvo_id,
            risk_score: risk_score.min(100),
            indicators,
            confidence: confidence.min(100),
            auditor: auditor.clone(),
            timestamp: env.ledger().timestamp(),
            evidence_hash,
        };

        let storage = env.storage().persistent();
        let mut results: Map<u32, FraudDetectionResult> = storage.get(&FRAUD_RESULTS).unwrap_or_else(|| Map::new(&env));
        results.set(id, result);
        storage.set(&FRAUD_RESULTS, &results);

        Self::add_to_pvo_index(&env, pvo_id, id);

        FraudDetectedEvent { pvo_id, risk_score, auditor }.publish(&env);
        id
    }

    /// Submit a risk prediction (AI auditor only)
    pub fn submit_risk_prediction(
        env: Env,
        auditor: Address,
        contractor: Address,
        delay_probability: u32,
        overrun_probability: u32,
        risk_category: u32,
        confidence: u32,
    ) -> u32 {
        auditor.require_auth();
        assert!(Self::is_ai_auditor(&env, &auditor), "only AI auditors can submit");

        let id = Self::next_id(&env);
        let prediction = RiskPrediction {
            id,
            contractor: contractor.clone(),
            delay_probability: delay_probability.min(100),
            overrun_probability: overrun_probability.min(100),
            risk_category: risk_category.min(3),
            confidence: confidence.min(100),
            auditor,
            timestamp: env.ledger().timestamp(),
        };

        let storage = env.storage().persistent();
        let mut predictions: Map<u32, RiskPrediction> = storage.get(&RISK_PREDICTIONS).unwrap_or_else(|| Map::new(&env));
        predictions.set(id, prediction);
        storage.set(&RISK_PREDICTIONS, &predictions);

        RiskPredictedEvent { contractor, risk_category }.publish(&env);
        id
    }

    /// Submit image/satellite verification result (AI auditor only)
    pub fn submit_image_verification(
        env: Env,
        auditor: Address,
        evidence_id: u32,
        progress_percent: u32,
        authenticity_score: u32,
        summary: String,
    ) -> u32 {
        auditor.require_auth();
        assert!(Self::is_ai_auditor(&env, &auditor), "only AI auditors can submit");

        let id = Self::next_id(&env);
        let verification = ImageVerification {
            id,
            evidence_id,
            progress_percent: progress_percent.min(100),
            authenticity_score: authenticity_score.min(100),
            summary,
            auditor,
            timestamp: env.ledger().timestamp(),
        };

        let storage = env.storage().persistent();
        let mut verifications: Map<u32, ImageVerification> = storage.get(&IMAGE_VERIFICATIONS).unwrap_or_else(|| Map::new(&env));
        verifications.set(id, verification);
        storage.set(&IMAGE_VERIFICATIONS, &verifications);

        ImageVerifiedEvent { evidence_id, progress_percent }.publish(&env);
        id
    }

    /// Update digital twin (procurement cost simulation)
    pub fn update_digital_twin(
        env: Env,
        auditor: Address,
        pvo_id: u32,
        expected_cost: i128,
        material_cost_index: u32,
        labor_cost_index: u32,
        deviation_alert: bool,
    ) {
        auditor.require_auth();
        assert!(Self::is_ai_auditor(&env, &auditor), "only AI auditors can submit");

        let twin = DigitalTwin {
            pvo_id,
            expected_cost,
            material_cost_index,
            labor_cost_index,
            deviation_alert,
            last_updated: env.ledger().timestamp(),
        };

        let storage = env.storage().persistent();
        let mut twins: Map<u32, DigitalTwin> = storage.get(&DIGITAL_TWINS).unwrap_or_else(|| Map::new(&env));
        twins.set(pvo_id, twin);
        storage.set(&DIGITAL_TWINS, &twins);

        DigitalTwinUpdatedEvent { pvo_id, expected_cost, deviation_alert }.publish(&env);
    }

    /// Submit geographic risk assessment (flood, seismic, landslide per region)
    pub fn submit_geo_risk(
        env: Env,
        auditor: Address,
        pvo_id: u32,
        region: String,
        flood_risk: u32,
        seismic_risk: u32,
        landslide_risk: u32,
    ) {
        auditor.require_auth();
        assert!(Self::is_ai_auditor(&env, &auditor), "only AI auditors can submit");

        let max_risk = flood_risk.max(seismic_risk).max(landslide_risk);
        let avg_risk = (flood_risk.saturating_add(seismic_risk).saturating_add(landslide_risk)) / 3;
        let overall = (max_risk.saturating_mul(60).saturating_add(avg_risk.saturating_mul(40))) / 100;

        let assessment = GeoRiskAssessment {
            pvo_id,
            region: region.clone(),
            flood_risk: flood_risk.min(100),
            seismic_risk: seismic_risk.min(100),
            landslide_risk: landslide_risk.min(100),
            overall_risk_score: overall.min(100),
            auditor,
            timestamp: env.ledger().timestamp(),
        };

        let storage = env.storage().persistent();
        let mut risks: Map<u32, GeoRiskAssessment> = storage.get(&GEO_RISKS).unwrap_or_else(|| Map::new(&env));
        risks.set(pvo_id, assessment);
        storage.set(&GEO_RISKS, &risks);

        GeoRiskAssessedEvent { pvo_id, region, overall_risk_score: overall }.publish(&env);
    }

    /// Submit GPS coordinate validation (compare expected vs reported)
    pub fn submit_gps_validation(
        env: Env,
        auditor: Address,
        evidence_id: u32,
        expected_lat: i128,
        expected_lon: i128,
        reported_lat: i128,
        reported_lon: i128,
        max_distance_m: u32,
    ) -> u32 {
        auditor.require_auth();
        assert!(Self::is_ai_auditor(&env, &auditor), "only AI auditors can submit");

        let d_lat = if expected_lat > reported_lat {
            expected_lat.saturating_sub(reported_lat)
        } else {
            reported_lat.saturating_sub(expected_lat)
        };
        let d_lon = if expected_lon > reported_lon {
            expected_lon.saturating_sub(reported_lon)
        } else {
            reported_lon.saturating_sub(expected_lon)
        };

        // Microdegrees: 1 microdegree ≈ 0.11m. Convert threshold to microdegrees.
        let threshold_udeg = (max_distance_m as i128).saturating_mul(9);
        let within_range = d_lat <= threshold_udeg && d_lon <= threshold_udeg;
        let distance = (d_lat.max(d_lon) as u32).min(u32::MAX / 2);

        let id = Self::next_id(&env);
        let validation = GpsValidation {
            id,
            evidence_id,
            expected_lat,
            expected_lon,
            reported_lat,
            reported_lon,
            distance_meters: distance,
            within_range,
            auditor,
            timestamp: env.ledger().timestamp(),
        };

        let storage = env.storage().persistent();
        let mut validations: Map<u32, GpsValidation> = storage.get(&GPS_VALIDATIONS).unwrap_or_else(|| Map::new(&env));
        validations.set(id, validation);
        storage.set(&GPS_VALIDATIONS, &validations);

        GpsValidatedEvent { evidence_id, within_range, distance_meters: distance }.publish(&env);
        id
    }

    // ─── Queries ───

    pub fn get_fraud_detection(env: Env, id: u32) -> Option<FraudDetectionResult> {
        let storage = env.storage().persistent();
        let results: Map<u32, FraudDetectionResult> = storage.get(&FRAUD_RESULTS).unwrap_or_else(|| Map::new(&env));
        results.get(id)
    }

    pub fn get_fraud_by_pvo(env: Env, pvo_id: u32) -> Vec<FraudDetectionResult> {
        let storage = env.storage().persistent();
        let results: Map<u32, FraudDetectionResult> = storage.get(&FRAUD_RESULTS).unwrap_or_else(|| Map::new(&env));
        let pvo_idx: Map<u32, Vec<u32>> = storage.get(&PVO_FRAUD_IDX).unwrap_or_else(|| Map::new(&env));
        let ids = pvo_idx.get(pvo_id).unwrap_or_else(|| Vec::new(&env));

        let mut out: Vec<FraudDetectionResult> = Vec::new(&env);
        for i in 0..ids.len() {
            if let Some(id) = ids.get(i) {
                if let Some(r) = results.get(id) {
                    out.push_back(r);
                }
            }
        }
        out
    }

    pub fn get_latest_risk_prediction(env: Env, contractor: Address) -> Option<RiskPrediction> {
        let storage = env.storage().persistent();
        let predictions: Map<u32, RiskPrediction> = storage.get(&RISK_PREDICTIONS).unwrap_or_else(|| Map::new(&env));
        let mut latest: Option<RiskPrediction> = None;
        for (_, pred) in predictions.iter() {
            if pred.contractor == contractor {
                match &latest {
                    None => latest = Some(pred),
                    Some(l) if pred.timestamp > l.timestamp => latest = Some(pred),
                    _ => {}
                }
            }
        }
        latest
    }

    pub fn get_image_verification(env: Env, id: u32) -> Option<ImageVerification> {
        let storage = env.storage().persistent();
        let verifications: Map<u32, ImageVerification> = storage.get(&IMAGE_VERIFICATIONS).unwrap_or_else(|| Map::new(&env));
        verifications.get(id)
    }

    pub fn get_digital_twin(env: Env, pvo_id: u32) -> Option<DigitalTwin> {
        let storage = env.storage().persistent();
        let twins: Map<u32, DigitalTwin> = storage.get(&DIGITAL_TWINS).unwrap_or_else(|| Map::new(&env));
        twins.get(pvo_id)
    }

    pub fn get_fraud_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let results: Map<u32, FraudDetectionResult> = storage.get(&FRAUD_RESULTS).unwrap_or_else(|| Map::new(&env));
        results.len() as u32
    }

    pub fn get_geo_risk(env: Env, pvo_id: u32) -> Option<GeoRiskAssessment> {
        let storage = env.storage().persistent();
        let risks: Map<u32, GeoRiskAssessment> = storage.get(&GEO_RISKS).unwrap_or_else(|| Map::new(&env));
        risks.get(pvo_id)
    }

    pub fn get_gps_validation(env: Env, id: u32) -> Option<GpsValidation> {
        let storage = env.storage().persistent();
        let validations: Map<u32, GpsValidation> = storage.get(&GPS_VALIDATIONS).unwrap_or_else(|| Map::new(&env));
        validations.get(id)
    }

    // ─── Helpers ───

    fn add_to_pvo_index(env: &Env, pvo_id: u32, id: u32) {
        let storage = env.storage().persistent();
        let mut idx: Map<u32, Vec<u32>> = storage.get(&PVO_FRAUD_IDX).unwrap_or_else(|| Map::new(env));
        let mut ids = idx.get(pvo_id).unwrap_or_else(|| Vec::new(env));
        ids.push_back(id);
        idx.set(pvo_id, ids);
        storage.set(&PVO_FRAUD_IDX, &idx);
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
