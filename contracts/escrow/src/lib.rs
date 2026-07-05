#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, token, Address, Env, Map, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Created,
    Funded,
    EngineerApproved,
    AIValidated,
    CompliancePassed,
    OracleValidated,
    CommunityVerified,
    Ready,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnlockCondition {
    pub engineer_approval: bool,
    pub ai_risk_check: bool,
    pub compliance_validation: bool,
    pub community_oracle_validation: bool,
    pub community_confirmation: u32,
    pub community_required: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub id: u32,
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub funder: Address,
    pub recipient: Address,
    pub amount: i128,
    pub token_address: Address,
    pub status: EscrowStatus,
    pub conditions: UnlockCondition,
    pub created_at: u64,
    pub released_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowCreatedEvent {
    pub id: u32,
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub amount: i128,
    pub recipient: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowFundedEvent {
    pub id: u32,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowReleasedEvent {
    pub id: u32,
    pub amount: i128,
    pub recipient: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowRefundedEvent {
    pub id: u32,
    pub amount: i128,
    pub funder: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowConditionUpdatedEvent {
    pub id: u32,
    pub status: EscrowStatus,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowDisputedEvent {
    pub id: u32,
    pub disputer: Address,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const ESCROWS: Symbol = symbol_short!("ESCROWS");
const INITIALIZED: Symbol = symbol_short!("INIT");
const COMPLIANCE_ENGINE: Symbol = symbol_short!("COMPENG");
const COMMUNITY_ORACLE: Symbol = symbol_short!("COMOR");

#[contract]
pub struct DynamicEscrow;

#[contractimpl]
impl DynamicEscrow {
    pub fn initialize(env: Env, compliance_engine: Address, community_oracle: Address) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&COMPLIANCE_ENGINE, &compliance_engine);
        storage.set(&COMMUNITY_ORACLE, &community_oracle);
        storage.set(&INITIALIZED, &true);
    }

    pub fn create_escrow(
        env: Env,
        funder: Address,
        recipient: Address,
        pvo_id: u32,
        milestone_id: u32,
        amount: i128,
        token_address: Address,
        community_required: u32,
    ) -> u32 {
        funder.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let id = Self::next_id(&env);
        let now = env.ledger().timestamp();

        let conditions = UnlockCondition {
            engineer_approval: false,
            ai_risk_check: false,
            compliance_validation: false,
            community_confirmation: 0,
            community_required,
            community_oracle_validation: false,
        };

        let escrow = Escrow {
            id,
            pvo_id,
            milestone_id,
            funder: funder.clone(),
            recipient: recipient.clone(),
            amount,
            token_address: token_address.clone(),
            status: EscrowStatus::Created,
            conditions,
            created_at: now,
            released_at: 0,
        };

        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        escrows.set(id, escrow);
        storage.set(&ESCROWS, &escrows);

        EscrowCreatedEvent { id, pvo_id, milestone_id, amount, recipient }.publish(&env);

        id
    }

    pub fn fund_escrow(env: Env, funder: Address, escrow_id: u32, amount: i128) {
        funder.require_auth();

        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        if escrow.funder != funder {
            panic!("only the funder can fund this escrow");
        }

        if escrow.status != EscrowStatus::Created {
            panic!("escrow is not in created state");
        }

        if amount != escrow.amount {
            panic!("funding amount must match escrow amount");
        }

        // Transfer real tokens from funder to this contract
        let token_client = token::Client::new(&env, &escrow.token_address);
        token_client.transfer(&funder, &env.current_contract_address(), &amount);

        escrow.status = EscrowStatus::Funded;
        escrows.set(escrow_id, escrow);

        storage.set(&ESCROWS, &escrows);

        EscrowFundedEvent { id: escrow_id, amount }.publish(&env);
    }

    pub fn engineer_approve(env: Env, engineer: Address, escrow_id: u32) {
        engineer.require_auth();
        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        escrow.conditions.engineer_approval = true;
        escrow.status = EscrowStatus::EngineerApproved;
        Self::advance_if_ready(&env, &mut escrow);
        let new_status = escrow.status.clone();
        escrows.set(escrow_id, escrow);
        storage.set(&ESCROWS, &escrows);

        EscrowConditionUpdatedEvent { id: escrow_id, status: new_status }.publish(&env);
    }

    pub fn ai_validate(env: Env, auditor: Address, escrow_id: u32, passed: bool) {
        auditor.require_auth();
        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        let mut status_changed = false;
        if passed {
            escrow.conditions.ai_risk_check = true;
            escrow.status = EscrowStatus::AIValidated;
            status_changed = true;
        }

        Self::advance_if_ready(&env, &mut escrow);
        let new_status = escrow.status.clone();
        escrows.set(escrow_id, escrow);
        storage.set(&ESCROWS, &escrows);

        if status_changed {
            EscrowConditionUpdatedEvent { id: escrow_id, status: new_status }.publish(&env);
        }
    }

    pub fn compliance_validate(env: Env, compliance_officer: Address, escrow_id: u32, passed: bool) {
        compliance_officer.require_auth();
        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        let mut status_changed = false;
        if passed {
            escrow.conditions.compliance_validation = true;
            escrow.status = EscrowStatus::CompliancePassed;
            status_changed = true;
        }

        Self::advance_if_ready(&env, &mut escrow);
        let new_status = escrow.status.clone();
        escrows.set(escrow_id, escrow);
        storage.set(&ESCROWS, &escrows);

        if status_changed {
            EscrowConditionUpdatedEvent { id: escrow_id, status: new_status }.publish(&env);
        }
    }

    pub fn community_oracle_validate(env: Env, citizen: Address, escrow_id: u32) {
        citizen.require_auth();
        let storage = env.storage().persistent();
        
        // Cross-contract: require at least 1 verified community report for this PVO
        let escrows_init: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let escrow_check = escrows_init.get(escrow_id).expect("escrow not found");
        
        if let Some(oracle_addr) = storage.get::<Symbol, Address>(&COMMUNITY_ORACLE) {
            let verified: u32 = env.invoke_contract(&oracle_addr, &Symbol::new(&env, "get_verified_report_count"), soroban_sdk::vec![&env, escrow_check.pvo_id.into()]);
            assert!(verified > 0, "no verified community reports for this PVO");
        }

        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        escrow.conditions.community_oracle_validation = true;
        escrow.status = EscrowStatus::OracleValidated;

        Self::advance_if_ready(&env, &mut escrow);
        let new_status = escrow.status.clone();
        escrows.set(escrow_id, escrow);
        storage.set(&ESCROWS, &escrows);

        EscrowConditionUpdatedEvent { id: escrow_id, status: new_status }.publish(&env);
    }

    pub fn add_community_confirmation(env: Env, citizen: Address, escrow_id: u32) {
        citizen.require_auth();
        let storage = env.storage().persistent();
        
        // Cross-contract: require verified community reports for this PVO
        let escrows_init: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let escrow_check = escrows_init.get(escrow_id).expect("escrow not found");
        
        if let Some(oracle_addr) = storage.get::<Symbol, Address>(&COMMUNITY_ORACLE) {
            let verified: u32 = env.invoke_contract(&oracle_addr, &Symbol::new(&env, "get_verified_report_count"), soroban_sdk::vec![&env, escrow_check.pvo_id.into()]);
            assert!(verified > 0, "no verified community reports for this PVO");
        }

        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        escrow.conditions.community_confirmation = escrow.conditions.community_confirmation.saturating_add(1);

        if escrow.conditions.community_confirmation >= escrow.conditions.community_required {
            escrow.status = EscrowStatus::CommunityVerified;
        }

        Self::advance_if_ready(&env, &mut escrow);
        let new_status = escrow.status.clone();
        escrows.set(escrow_id, escrow);
        storage.set(&ESCROWS, &escrows);

        EscrowConditionUpdatedEvent { id: escrow_id, status: new_status }.publish(&env);
    }

    pub fn check_conditions(env: Env, escrow_id: u32) -> bool {
        let storage = env.storage().persistent();
        let escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let escrow = escrows.get(escrow_id).expect("escrow not found");

        escrow.conditions.engineer_approval
            && escrow.conditions.ai_risk_check
            && escrow.conditions.compliance_validation
            && escrow.conditions.community_oracle_validation
            && escrow.conditions.community_confirmation >= escrow.conditions.community_required
            && escrow.status == EscrowStatus::Funded
            || Self::is_unlocked(&env, &escrow)
    }

    pub fn release(env: Env, caller: Address, escrow_id: u32) -> bool {
        caller.require_auth();

        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let escrow = escrows.get(escrow_id).expect("escrow not found");

        if !Self::is_unlocked(&env, &escrow) {
            return false;
        }

        if escrow.status == EscrowStatus::Released {
            panic!("escrow already released");
        }

        let mut escrow = escrow;
        escrow.status = EscrowStatus::Released;
        escrow.released_at = env.ledger().timestamp();
        let amount = escrow.amount;
        let recipient = escrow.recipient.clone();
        let token_address = escrow.token_address.clone();
        escrows.set(escrow_id, escrow);
        storage.set(&ESCROWS, &escrows);

        // Transfer real tokens from contract to recipient
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &recipient, &amount);

        EscrowReleasedEvent {
            id: escrow_id,
            amount,
            recipient,
        }.publish(&env);

        true
    }

    pub fn refund(env: Env, funder: Address, escrow_id: u32) -> bool {
        funder.require_auth();

        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        if escrow.funder != funder {
            panic!("only the funder can refund");
        }

        if escrow.status == EscrowStatus::Released {
            panic!("cannot refund released escrow");
        }

        if escrow.status != EscrowStatus::Disputed && Self::is_unlocked(&env, &escrow) {
            panic!("cannot refund escrow with met conditions");
        }

        let amount = escrow.amount;
        let token_address = escrow.token_address.clone();
        escrow.status = EscrowStatus::Refunded;
        escrows.set(escrow_id, escrow.clone());
        storage.set(&ESCROWS, &escrows);

        // Return tokens to funder
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &funder, &amount);

        EscrowRefundedEvent {
            id: escrow_id,
            amount: escrow.amount,
            funder,
        }.publish(&env);

        true
    }

    pub fn dispute(env: Env, disputer: Address, escrow_id: u32) {
        disputer.require_auth();

        let storage = env.storage().persistent();
        let mut escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        let mut escrow = escrows.get(escrow_id).expect("escrow not found");

        if escrow.status == EscrowStatus::Released {
            panic!("cannot dispute released escrow");
        }

        escrow.status = EscrowStatus::Disputed;
        escrows.set(escrow_id, escrow.clone());
        storage.set(&ESCROWS, &escrows);

        EscrowDisputedEvent { id: escrow_id, disputer }.publish(&env);
    }

    pub fn get_escrow(env: Env, escrow_id: u32) -> Option<Escrow> {
        let storage = env.storage().persistent();
        let escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        escrows.get(escrow_id)
    }

    pub fn get_escrows_by_pvo(env: Env, pvo_id: u32) -> Vec<Escrow> {
        let storage = env.storage().persistent();
        let escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));

        let mut result: Vec<Escrow> = Vec::new(&env);
        for (_, escrow) in escrows.iter() {
            if escrow.pvo_id == pvo_id {
                result.push_back(escrow);
            }
        }
        result
    }

    pub fn get_escrow_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let escrows: Map<u32, Escrow> = storage.get(&ESCROWS).unwrap_or_else(|| Map::new(&env));
        escrows.len() as u32
    }

    fn is_unlocked(env: &Env, escrow: &Escrow) -> bool {
        // All 5 gates must pass
        let gates_ok = escrow.conditions.engineer_approval
            && escrow.conditions.ai_risk_check
            && escrow.conditions.compliance_validation
            && escrow.conditions.community_oracle_validation
            && escrow.conditions.community_confirmation >= escrow.conditions.community_required;

        if !gates_ok {
            return false;
        }

        // Cross-contract: check PVO is compliant (no unresolved auto-paused violations)
        let storage = env.storage().persistent();
        if let Some(compliance_addr) = storage.get::<Symbol, Address>(&COMPLIANCE_ENGINE) {
            let compliant: bool = env.invoke_contract(&compliance_addr, &Symbol::new(&env, "is_pvo_compliant"), soroban_sdk::vec![&env, escrow.pvo_id.into()]);
            compliant
        } else {
            true
        }
    }

    fn advance_if_ready(env: &Env, escrow: &mut Escrow) {
        if Self::is_unlocked(env, escrow) && escrow.status != EscrowStatus::Released {
            escrow.status = EscrowStatus::Ready;
        }
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
