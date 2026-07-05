#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PVOStatus {
    Proposed,
    Approved,
    InProgress,
    UnderReview,
    Completed,
    Suspended,
    Terminated,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    EvidenceSubmitted,
    EngineerApproved,
    AIValidated,
    CommunityVerified,
    CompliancePassed,
    Released,
    Rejected,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EvidenceType {
    DroneImagery,
    SatelliteImagery,
    GpsCoordinates,
    TimestampedPhoto,
    TimestampedVideo,
    IoTSensor,
    EngineeringReport,
    LabResult,
    InspectionReport,
    CommunityVerification,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Evidence {
    pub id: u32,
    pub evidence_type: EvidenceType,
    pub submitter: Address,
    pub data_hash: String,
    pub metadata: String,
    pub submitted_at: u64,
    pub verified: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub budget: i128,
    pub status: MilestoneStatus,
    pub required_evidence: Vec<EvidenceType>,
    pub submitted_evidence: Vec<Evidence>,
    pub engineer_approved: bool,
    pub ai_validated: bool,
    pub compliance_passed: bool,
    pub community_confirmations: u32,
    pub community_required: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicValueObject {
    pub id: u32,
    pub title: String,
    pub description: String,
    pub funding_agency: Address,
    pub contractor: Address,
    pub project_manager: Address,
    pub department: String,
    pub municipality: String,
    pub total_budget: i128,
    pub status: PVOStatus,
    pub milestones: Vec<u32>,
    pub created_at: u64,
    pub updated_at: u64,
    pub public_value_score: u32,
    pub fund_source: String,
    pub deadline: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PVOCreatedEvent {
    pub id: u32,
    pub title: String,
    pub contractor: Address,
    pub total_budget: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PVOStatusChangedEvent {
    pub id: u32,
    pub old_status: PVOStatus,
    pub new_status: PVOStatus,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneCreatedEvent {
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub budget: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EvidenceSubmittedEvent {
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub evidence_id: u32,
    pub evidence_type: EvidenceType,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MilestoneStatusChangedEvent {
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub new_status: MilestoneStatus,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ValueScoreUpdatedEvent {
    pub pvo_id: u32,
    pub score: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const PVOS: Symbol = symbol_short!("PVOS");
const MILESTONES: Symbol = symbol_short!("MSTNS");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct PVOCore;

#[contractimpl]
impl PVOCore {
    pub fn initialize(env: Env) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn create_pvo(
        env: Env,
        creator: Address,
        title: String,
        description: String,
        funding_agency: Address,
        contractor: Address,
        project_manager: Address,
        department: String,
        municipality: String,
        total_budget: i128,
        fund_source: String,
        deadline: u64,
    ) -> u32 {
        creator.require_auth();

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();

        let pvo = PublicValueObject {
            id,
            title: title.clone(),
            description,
            funding_agency,
            contractor: contractor.clone(),
            project_manager,
            department,
            municipality,
            total_budget,
            status: PVOStatus::Proposed,
            milestones: Vec::new(&env),
            created_at: now,
            updated_at: now,
            public_value_score: 0,
            fund_source,
            deadline,
        };

        let storage = env.storage().persistent();
        let mut pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        pvos.set(id, pvo);
        storage.set(&PVOS, &pvos);

        PVOCreatedEvent { id, title, contractor, total_budget }.publish(&env);

        id
    }

    pub fn update_pvo_status(env: Env, updater: Address, pvo_id: u32, new_status: PVOStatus) {
        updater.require_auth();

        let storage = env.storage().persistent();
        let mut pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        let mut pvo = pvos.get(pvo_id).expect("PVO not found");

        let old_status = pvo.status.clone();
        pvo.status = new_status.clone();
        pvo.updated_at = env.ledger().timestamp();
        pvos.set(pvo_id, pvo.clone());
        storage.set(&PVOS, &pvos);

        PVOStatusChangedEvent { id: pvo_id, old_status, new_status }.publish(&env);
    }

    pub fn update_value_score(env: Env, updater: Address, pvo_id: u32, score: u32) {
        updater.require_auth();
        let storage = env.storage().persistent();
        let mut pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        let mut pvo = pvos.get(pvo_id).expect("PVO not found");
        pvo.public_value_score = score;
        pvo.updated_at = env.ledger().timestamp();
        pvos.set(pvo_id, pvo);
        storage.set(&PVOS, &pvos);

        ValueScoreUpdatedEvent { pvo_id, score }.publish(&env);
    }

    pub fn create_milestone(
        env: Env,
        creator: Address,
        pvo_id: u32,
        title: String,
        description: String,
        budget: i128,
        required_evidence: Vec<EvidenceType>,
        community_required: u32,
    ) -> u32 {
        creator.require_auth();

        let storage = env.storage().persistent();
        let mut pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        let mut pvo = pvos.get(pvo_id).expect("PVO not found");

        if budget > pvo.total_budget {
            panic!("milestone budget exceeds PVO total budget");
        }

        let milestone_id = Self::next_id(&env);
        let milestone = Milestone {
            id: milestone_id,
            title: title.clone(),
            description,
            budget,
            status: MilestoneStatus::Pending,
            required_evidence,
            submitted_evidence: Vec::new(&env),
            engineer_approved: false,
            ai_validated: false,
            compliance_passed: false,
            community_confirmations: 0,
            community_required,
        };

        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        milestones.set(milestone_id, milestone);

        pvo.milestones.push_back(milestone_id);
        pvo.updated_at = env.ledger().timestamp();
        pvos.set(pvo_id, pvo);

        storage.set(&MILESTONES, &milestones);
        storage.set(&PVOS, &pvos);

        MilestoneCreatedEvent { pvo_id, milestone_id, budget }.publish(&env);

        milestone_id
    }

    pub fn submit_evidence(
        env: Env,
        submitter: Address,
        pvo_id: u32,
        milestone_id: u32,
        evidence_type: EvidenceType,
        data_hash: String,
        metadata: String,
    ) -> u32 {
        submitter.require_auth();

        let storage = env.storage().persistent();
        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let mut milestone = milestones.get(milestone_id).expect("milestone not found");

        if milestone.status == MilestoneStatus::Released || milestone.status == MilestoneStatus::Rejected {
            panic!("cannot submit evidence to completed milestone");
        }

        let evidence_id = Self::next_id(&env);
        let evidence = Evidence {
            id: evidence_id,
            evidence_type: evidence_type.clone(),
            submitter,
            data_hash,
            metadata,
            submitted_at: env.ledger().timestamp(),
            verified: false,
        };

        milestone.submitted_evidence.push_back(evidence);

        if milestone.status == MilestoneStatus::Pending {
            milestone.status = MilestoneStatus::EvidenceSubmitted;
        }

        milestones.set(milestone_id, milestone);
        storage.set(&MILESTONES, &milestones);

        EvidenceSubmittedEvent { pvo_id, milestone_id, evidence_id, evidence_type }.publish(&env);

        evidence_id
    }

    pub fn engineer_approve(env: Env, engineer: Address, milestone_id: u32) {
        engineer.require_auth();

        let storage = env.storage().persistent();
        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let mut milestone = milestones.get(milestone_id).expect("milestone not found");

        milestone.engineer_approved = true;
        milestone.status = MilestoneStatus::EngineerApproved;
        milestones.set(milestone_id, milestone);
        storage.set(&MILESTONES, &milestones);

        MilestoneStatusChangedEvent {
            pvo_id: 0,
            milestone_id,
            new_status: MilestoneStatus::EngineerApproved,
        }.publish(&env);
    }

    pub fn ai_validate(env: Env, auditor: Address, milestone_id: u32, passed: bool) {
        auditor.require_auth();
        let storage = env.storage().persistent();
        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let mut milestone = milestones.get(milestone_id).expect("milestone not found");

        milestone.ai_validated = passed;
        let mut new_status = None;
        if passed {
            milestone.status = MilestoneStatus::AIValidated;
            new_status = Some(milestone.status.clone());
        }
        milestones.set(milestone_id, milestone);
        storage.set(&MILESTONES, &milestones);

        if let Some(status) = new_status {
            MilestoneStatusChangedEvent { pvo_id: 0, milestone_id, new_status: status }.publish(&env);
        }
    }

    pub fn compliance_check(env: Env, officer: Address, milestone_id: u32, passed: bool) {
        officer.require_auth();
        let storage = env.storage().persistent();
        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let mut milestone = milestones.get(milestone_id).expect("milestone not found");

        milestone.compliance_passed = passed;
        let mut new_status = None;
        if passed {
            milestone.status = MilestoneStatus::CompliancePassed;
            new_status = Some(milestone.status.clone());
        }
        milestones.set(milestone_id, milestone);
        storage.set(&MILESTONES, &milestones);

        if let Some(status) = new_status {
            MilestoneStatusChangedEvent { pvo_id: 0, milestone_id, new_status: status }.publish(&env);
        }
    }

    pub fn add_community_verification(env: Env, citizen: Address, milestone_id: u32) {
        citizen.require_auth();
        let storage = env.storage().persistent();
        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let mut milestone = milestones.get(milestone_id).expect("milestone not found");

        milestone.community_confirmations = milestone.community_confirmations.saturating_add(1);

        let mut new_status = None;
        if milestone.community_confirmations >= milestone.community_required {
            milestone.status = MilestoneStatus::CommunityVerified;
            new_status = Some(milestone.status.clone());
        }

        milestones.set(milestone_id, milestone);
        storage.set(&MILESTONES, &milestones);

        if let Some(status) = new_status {
            MilestoneStatusChangedEvent { pvo_id: 0, milestone_id, new_status: status }.publish(&env);
        }
    }

    pub fn check_milestone_ready(env: Env, milestone_id: u32) -> bool {
        let storage = env.storage().persistent();
        let milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let milestone = milestones.get(milestone_id).expect("milestone not found");

        let has_required_evidence = Self::has_all_evidence_types(&milestone);
        milestone.engineer_approved
            && milestone.ai_validated
            && milestone.compliance_passed
            && milestone.community_confirmations >= milestone.community_required
            && has_required_evidence
    }

    pub fn release_milestone(env: Env, caller: Address, milestone_id: u32) -> bool {
        caller.require_auth();

        let storage = env.storage().persistent();
        let mut milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        let mut milestone = milestones.get(milestone_id).expect("milestone not found");

        let has_required_evidence = Self::has_all_evidence_types(&milestone);
        let ready = milestone.engineer_approved
            && milestone.ai_validated
            && milestone.compliance_passed
            && milestone.community_confirmations >= milestone.community_required
            && has_required_evidence;

        if !ready {
            return false;
        }

        milestone.status = MilestoneStatus::Released;
        milestones.set(milestone_id, milestone);
        storage.set(&MILESTONES, &milestones);

        MilestoneStatusChangedEvent {
            pvo_id: 0,
            milestone_id,
            new_status: MilestoneStatus::Released,
        }.publish(&env);

        true
    }

    pub fn get_pvo(env: Env, pvo_id: u32) -> Option<PublicValueObject> {
        let storage = env.storage().persistent();
        let pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        pvos.get(pvo_id)
    }

    pub fn get_milestone(env: Env, milestone_id: u32) -> Option<Milestone> {
        let storage = env.storage().persistent();
        let milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));
        milestones.get(milestone_id)
    }

    pub fn get_pvo_milestones(env: Env, pvo_id: u32) -> Vec<Milestone> {
        let storage = env.storage().persistent();
        let pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        let pvo = pvos.get(pvo_id).expect("PVO not found");
        let milestones: Map<u32, Milestone> = storage.get(&MILESTONES).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<Milestone> = Vec::new(&env);
        for i in 0..pvo.milestones.len() {
            if let Some(mid) = pvo.milestones.get(i) {
                if let Some(m) = milestones.get(mid) {
                    result.push_back(m);
                }
            }
        }
        result
    }

    pub fn get_pvo_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));
        pvos.len() as u32
    }

    pub fn get_pv_os_by_contractor(env: Env, contractor: Address) -> Vec<PublicValueObject> {
        let storage = env.storage().persistent();
        let pvos: Map<u32, PublicValueObject> = storage.get(&PVOS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<PublicValueObject> = Vec::new(&env);
        for (_, pvo) in pvos.iter() {
            if pvo.contractor == contractor {
                result.push_back(pvo);
            }
        }
        result
    }

    fn next_id(env: &Env) -> u32 {
        let storage = env.storage().persistent();
        let mut id: u32 = storage.get(&COUNTER).unwrap_or(0);
        id += 1;
        storage.set(&COUNTER, &id);
        id
    }

    fn has_all_evidence_types(milestone: &Milestone) -> bool {
        if milestone.required_evidence.is_empty() {
            return true;
        }

        for i in 0..milestone.required_evidence.len() {
            if let Some(req) = milestone.required_evidence.get(i) {
                let mut found = false;
                for j in 0..milestone.submitted_evidence.len() {
                    if let Some(ev) = milestone.submitted_evidence.get(j) {
                        if ev.evidence_type == req {
                            found = true;
                            break;
                        }
                    }
                }
                if !found {
                    return false;
                }
            }
        }
        true
    }
}

mod test;
