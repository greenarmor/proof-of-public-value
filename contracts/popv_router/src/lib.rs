#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, Vec};
use access_control::{AccessControlClient, Role};
use pvo_core::{PVOCoreClient, PVOStatus, MilestoneStatus, EvidenceType};
use escrow::DynamicEscrowClient;
use community_oracle::{CommunityOracleClient, ReportType as OracleReportType};
use reputation::{ReputationLedgerClient, EntityType};
use audit_trail::{AuditTrailClient, DecisionCategory};
use value_score::{ValueScoreClient, ScoreCategory};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractAddresses {
    pub access_control: Address,
    pub pvo_core: Address,
    pub escrow: Address,
    pub community_oracle: Address,
    pub reputation: Address,
    pub audit_trail: Address,
    pub value_score: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProjectSummary {
    pub pvo_id: u32,
    pub pvo_title: String,
    pub pvo_status: PVOStatus,
    pub value_score: u32,
    pub milestone_count: u32,
    pub released_count: u32,
    pub contractor_reputation: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RouterConfiguredEvent {
    pub admin: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FullWorkflowCompletedEvent {
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub escrow_id: u32,
}

const ADDRESSES: Symbol = symbol_short!("ADDRS");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contract]
pub struct PoPVRouter;

#[contractimpl]
impl PoPVRouter {
    pub fn initialize(env: Env, admin: Address, addresses: ContractAddresses) {
        admin.require_auth();
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&ADDRESSES, &addresses);
        storage.set(&INITIALIZED, &true);

        RouterConfiguredEvent { admin }.publish(&env);
    }

    pub fn get_addresses(env: Env) -> ContractAddresses {
        env.storage().persistent().get(&ADDRESSES).expect("not initialized")
    }

    pub fn create_project_full(
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
        milestone_title: String,
        milestone_description: String,
        milestone_budget: i128,
        required_evidence: Vec<EvidenceType>,
        community_required: u32,
        escrow_community_required: u32,
    ) -> (u32, u32, u32) {
        creator.require_auth();

        let addrs = Self::get_addresses(env.clone());

        let pvo_client = PVOCoreClient::new(&env, &addrs.pvo_core);
        let pvo_id = pvo_client.create_pvo(
            &creator,
            &title,
            &description,
            &funding_agency,
            &contractor,
            &project_manager,
            &department,
            &municipality,
            &total_budget,
            &fund_source,
        );

        let milestone_id = pvo_client.create_milestone(
            &creator,
            &pvo_id,
            &milestone_title,
            &milestone_description,
            &milestone_budget,
            &required_evidence,
            &community_required,
        );

        let escrow_client = DynamicEscrowClient::new(&env, &addrs.escrow);
        let escrow_id = escrow_client.create_escrow(
            &funding_agency,
            &contractor,
            &pvo_id,
            &milestone_id,
            &milestone_budget,
            &escrow_community_required,
        );

        escrow_client.fund_escrow(&funding_agency, &escrow_id, &milestone_budget);

        let audit_client = AuditTrailClient::new(&env, &addrs.audit_trail);
        audit_client.record_decision(
            &creator,
            &pvo_id,
            &DecisionCategory::ProcurementAward,
            &String::from_str(&env, "Project created with escrow funded"),
            &String::from_str(&env, "Full project setup via router"),
            &String::from_str(&env, ""),
            &String::from_str(&env, "approved"),
            &0,
            &String::from_str(&env, "passed"),
            &String::from_str(&env, ""),
        );

        (pvo_id, milestone_id, escrow_id)
    }

    pub fn submit_evidence_and_approve(
        env: Env,
        submitter: Address,
        engineer: Address,
        pvo_id: u32,
        milestone_id: u32,
        escrow_id: u32,
        evidence_type: EvidenceType,
        data_hash: String,
    ) {
        submitter.require_auth();
        engineer.require_auth();

        let addrs = Self::get_addresses(env.clone());
        let pvo_client = PVOCoreClient::new(&env, &addrs.pvo_core);

        pvo_client.submit_evidence(
            &submitter,
            &pvo_id,
            &milestone_id,
            &evidence_type,
            &data_hash,
            &String::from_str(&env, ""),
        );

        pvo_client.engineer_approve(&engineer, &milestone_id);

        let escrow_client = DynamicEscrowClient::new(&env, &addrs.escrow);
        escrow_client.engineer_approve(&escrow_id);

        let audit_client = AuditTrailClient::new(&env, &addrs.audit_trail);
        audit_client.record_decision(
            &engineer,
            &pvo_id,
            &DecisionCategory::EvidenceReview,
            &String::from_str(&env, "Evidence submitted and engineer approved"),
            &String::from_str(&env, ""),
            &data_hash,
            &String::from_str(&env, "approved"),
            &0,
            &String::from_str(&env, "passed"),
            &String::from_str(&env, ""),
        );
    }

    pub fn validate_and_compliance(
        env: Env,
        auditor: Address,
        pvo_id: u32,
        milestone_id: u32,
        escrow_id: u32,
        ai_passed: bool,
        compliance_passed: bool,
    ) {
        auditor.require_auth();
        let addrs = Self::get_addresses(env.clone());

        let pvo_client = PVOCoreClient::new(&env, &addrs.pvo_core);
        pvo_client.ai_validate(&milestone_id, &ai_passed);
        pvo_client.compliance_check(&milestone_id, &compliance_passed);

        let escrow_client = DynamicEscrowClient::new(&env, &addrs.escrow);
        escrow_client.ai_validate(&escrow_id, &ai_passed);
        escrow_client.compliance_validate(&escrow_id, &compliance_passed);

        let audit_client = AuditTrailClient::new(&env, &addrs.audit_trail);
        let risk_score: u32 = if ai_passed { 10 } else { 80 };
        audit_client.record_decision(
            &auditor,
            &pvo_id,
            &DecisionCategory::AIRiskAssessment,
            &String::from_str(&env, "AI and compliance validation"),
            &String::from_str(&env, ""),
            &String::from_str(&env, ""),
            &String::from_str(&env, if ai_passed { "low risk" } else { "high risk" }),
            &risk_score,
            &String::from_str(&env, if compliance_passed { "passed" } else { "failed" }),
            &String::from_str(&env, ""),
        );
    }

    pub fn add_community_verifications(
        env: Env,
        _pvo_id: u32,
        milestone_id: u32,
        escrow_id: u32,
        count: u32,
    ) {
        let addrs = Self::get_addresses(env.clone());

        let pvo_client = PVOCoreClient::new(&env, &addrs.pvo_core);
        let escrow_client = DynamicEscrowClient::new(&env, &addrs.escrow);

        let mut i = 0u32;
        while i < count {
            pvo_client.add_community_verification(&milestone_id);
            escrow_client.add_community_confirmation(&escrow_id);
            i += 1;
        }
    }

    pub fn complete_milestone_full(
        env: Env,
        caller: Address,
        pvo_id: u32,
        milestone_id: u32,
        escrow_id: u32,
        _contractor: Address,
        value_score: u32,
    ) -> bool {
        caller.require_auth();

        let addrs = Self::get_addresses(env.clone());

        let pvo_client = PVOCoreClient::new(&env, &addrs.pvo_core);
        let escrow_client = DynamicEscrowClient::new(&env, &addrs.escrow);
        let audit_client = AuditTrailClient::new(&env, &addrs.audit_trail);
        let value_client = ValueScoreClient::new(&env, &addrs.value_score);

        let milestone = pvo_client.get_milestone(&milestone_id);
        match milestone {
            Some(m) => {
                if m.status == MilestoneStatus::Released {
                    panic!("milestone already released");
                }
            }
            None => panic!("milestone not found"),
        }

        let released = pvo_client.release_milestone(&milestone_id);
        if !released {
            return false;
        }

        let escrow_released = escrow_client.release(&caller, &escrow_id);
        if !escrow_released {
            return false;
        }

        value_client.submit_score(
            &caller,
            &pvo_id,
            &ScoreCategory::EngineeringQuality,
            &value_score,
            &50,
        );
        pvo_client.update_value_score(&pvo_id, &value_score);

        audit_client.record_decision(
            &caller,
            &pvo_id,
            &DecisionCategory::MilestoneRelease,
            &String::from_str(&env, "Milestone fully completed and funds released"),
            &String::from_str(&env, "All 5 gates passed"),
            &String::from_str(&env, ""),
            &String::from_str(&env, "completed"),
            &5,
            &String::from_str(&env, "passed"),
            &String::from_str(&env, ""),
        );

        FullWorkflowCompletedEvent {
            pvo_id,
            milestone_id,
            escrow_id,
        }.publish(&env);

        true
    }

    pub fn get_project_summary(env: Env, pvo_id: u32, _contractor: Address) -> ProjectSummary {
        let addrs = Self::get_addresses(env.clone());

        let pvo_client = PVOCoreClient::new(&env, &addrs.pvo_core);
        let reputation_client = ReputationLedgerClient::new(&env, &addrs.reputation);
        let value_client = ValueScoreClient::new(&env, &addrs.value_score);

        let pvo = pvo_client.get_pvo(&pvo_id).expect("PVO not found");
        let milestones = pvo_client.get_pvo_milestones(&pvo_id);

        let mut released_count = 0u32;
        for i in 0..milestones.len() {
            if let Some(m) = milestones.get(i) {
                if m.status == MilestoneStatus::Released {
                    released_count += 1;
                }
            }
        }

        let contractor_rep = reputation_client.get_reputation(&_contractor)
            .map(|r| r.reputation_score)
            .unwrap_or(0);

        let vscore = value_client.get_overall_score(&pvo_id);

        ProjectSummary {
            pvo_id,
            pvo_title: pvo.title,
            pvo_status: pvo.status,
            value_score: vscore,
            milestone_count: milestones.len() as u32,
            released_count,
            contractor_reputation: contractor_rep,
        }
    }

    pub fn assign_role_wrapped(
        env: Env,
        admin: Address,
        address: Address,
        role: Role,
    ) {
        admin.require_auth();
        let addrs = Self::get_addresses(env.clone());
        let ac_client = AccessControlClient::new(&env, &addrs.access_control);
        ac_client.assign_role(&admin, &address, &role);
    }

    pub fn check_role_wrapped(env: Env, address: Address, role: Role) -> bool {
        let addrs = Self::get_addresses(env.clone());
        let ac_client = AccessControlClient::new(&env, &addrs.access_control);
        ac_client.has_role(&address, &role)
    }

    pub fn register_contractor(
        env: Env,
        contractor: Address,
    ) {
        contractor.require_auth();
        let addrs = Self::get_addresses(env.clone());
        let rep_client = ReputationLedgerClient::new(&env, &addrs.reputation);
        rep_client.register_entity(&contractor, &EntityType::Contractor);
    }

    pub fn record_contractor_completion(
        env: Env,
        contractor: Address,
        value_score: u32,
        on_time: bool,
        within_budget: bool,
    ) {
        let addrs = Self::get_addresses(env.clone());
        let rep_client = ReputationLedgerClient::new(&env, &addrs.reputation);
        rep_client.record_completion(&contractor, &value_score, &on_time, &within_budget);
    }

    pub fn submit_citizen_report_wrapped(
        env: Env,
        citizen: Address,
        pvo_id: u32,
        milestone_id: u32,
        report_type: OracleReportType,
        data_hash: String,
        gps_lat: i128,
        gps_lon: i128,
    ) -> u32 {
        citizen.require_auth();
        let addrs = Self::get_addresses(env.clone());
        let oracle_client = CommunityOracleClient::new(&env, &addrs.community_oracle);
        oracle_client.submit_report(
            &citizen,
            &pvo_id,
            &milestone_id,
            &report_type,
            &data_hash,
            &gps_lat,
            &gps_lon,
        )
    }
}

mod test;
