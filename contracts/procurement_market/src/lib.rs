#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, contracttype, symbol_short, Address, Env, IntoVal, Map, String, Symbol, Vec};

// Cross-contract: import reputation client from its deployed WASM spec
mod reputation_client {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/reputation.wasm"
    );
}

use reputation_client::Client as ReputationClient;

// Cross-contract: import pvo_core client
mod pvo_core_client {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/pvo_core.wasm"
    );
}
use pvo_core_client::Client as PvoCoreClient;

// Cross-contract: import access_control client
mod access_control_client {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/access_control.wasm"
    );
}
use access_control_client::Client as AccessControlClient;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TenderStatus {
    Open,
    Closed,
    Awarded,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tender {
    pub id: u32,
    pub agency: Address,
    pub pvo_id: u32,
    pub milestone_id: u32,
    pub title: String,
    pub description: String,
    pub budget: i128,
    pub deadline: u64,
    pub status: TenderStatus,
    pub created_at: u64,
    pub winner: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bid {
    pub id: u32,
    pub tender_id: u32,
    pub contractor: Address,
    pub price: i128,
    pub quality_score: u32,
    pub timeline_days: u32,
    pub reputation_score: u32,
    pub final_score: u32,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TenderCreatedEvent {
    pub id: u32,
    pub agency: Address,
    pub budget: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BidSubmittedEvent {
    pub id: u32,
    pub tender_id: u32,
    pub contractor: Address,
    pub final_score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TenderAwardedEvent {
    pub tender_id: u32,
    pub winner: Address,
    pub final_score: u32,
}

const COUNTER: Symbol = symbol_short!("COUNTER");
const TENDERS: Symbol = symbol_short!("TENDERS");
const BIDS: Symbol = symbol_short!("BIDS");
const TENDER_BIDS: Symbol = symbol_short!("TNDRBIDS");
const INITIALIZED: Symbol = symbol_short!("INIT");
const REPUTATION: Symbol = symbol_short!("REP");
const PVO_CORE_ADDR: Symbol = symbol_short!("PVOCORE");
const ACCESS_CONTROL: Symbol = symbol_short!("AC");
const ADMIN: Symbol = symbol_short!("ADMIN");
const MIN_BIDS: Symbol = symbol_short!("MINBIDS");

#[contract]
pub struct ProcurementMarket;

#[contractimpl]
impl ProcurementMarket {
    pub fn initialize(env: Env, reputation_address: Address, pvo_core_address: Address, access_control_address: Address, admin: Address) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&COUNTER, &0u32);
        storage.set(&REPUTATION, &reputation_address);
        storage.set(&PVO_CORE_ADDR, &pvo_core_address);
        storage.set(&ACCESS_CONTROL, &access_control_address);
        storage.set(&ADMIN, &admin);
        storage.set(&MIN_BIDS, &1u32);
        storage.set(&INITIALIZED, &true);
    }

    pub fn set_min_bids(env: Env, admin: Address, min_bids: u32) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let stored_admin: Address = storage.get(&ADMIN).expect("admin not set");
        assert!(admin == stored_admin, "only admin can set min bids");
        assert!(min_bids >= 1, "min bids must be at least 1");
        storage.set(&MIN_BIDS, &min_bids);
    }

    pub fn get_min_bids(env: Env) -> u32 {
        let storage = env.storage().persistent();
        storage.get(&MIN_BIDS).unwrap_or(1)
    }

    pub fn update_pvo_core_address(env: Env, admin: Address, new_address: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let stored_admin: Address = storage.get(&ADMIN).expect("admin not set");
        assert!(admin == stored_admin, "only admin can update addresses");
        storage.set(&PVO_CORE_ADDR, &new_address);
    }

    pub fn update_reputation_address(env: Env, admin: Address, new_address: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let stored_admin: Address = storage.get(&ADMIN).expect("admin not set");
        assert!(admin == stored_admin, "only admin can update addresses");
        storage.set(&REPUTATION, &new_address);
    }

    pub fn update_access_control_address(env: Env, admin: Address, new_address: Address) {
        admin.require_auth();
        let storage = env.storage().persistent();
        let stored_admin: Address = storage.get(&ADMIN).expect("admin not set");
        assert!(admin == stored_admin, "only admin can update addresses");
        storage.set(&ACCESS_CONTROL, &new_address);
    }

    pub fn create_tender(
        env: Env,
        agency: Address,
        pvo_id: u32,
        milestone_id: u32,
        title: String,
        description: String,
        budget: i128,
        deadline: u64,
    ) -> u32 {
        agency.require_auth();
        let id = Self::next_id(&env);

        let tender = Tender {
            id,
            agency: agency.clone(),
            pvo_id,
            milestone_id,
            title: title.clone(),
            description,
            budget,
            deadline,
            status: TenderStatus::Open,
            created_at: env.ledger().timestamp(),
            winner: None,
        };

        let storage = env.storage().persistent();
        let mut tenders: Map<u32, Tender> = storage.get(&TENDERS).unwrap_or_else(|| Map::new(&env));
        tenders.set(id, tender);
        storage.set(&TENDERS, &tenders);

        TenderCreatedEvent { id, agency, budget }.publish(&env);
        id
    }

    pub fn submit_bid(
        env: Env,
        contractor: Address,
        tender_id: u32,
        price: i128,
        quality_score: u32,
        timeline_days: u32,
    ) -> u32 {
        contractor.require_auth();

        let storage = env.storage().persistent();

        // Role check: only Contractor or Supplier can submit bids
        let ac_address: Address = storage.get(&ACCESS_CONTROL).expect("access_control not configured");
        let ac_client = AccessControlClient::new(&env, &ac_address);
        let mut allowed_roles = Vec::new(&env);
        allowed_roles.push_back(access_control_client::Role::Contractor);
        allowed_roles.push_back(access_control_client::Role::Supplier);
        assert!(
            ac_client.has_any_role(&contractor, &allowed_roles),
            "only contractors and suppliers can submit bids"
        );

        let tenders: Map<u32, Tender> = storage.get(&TENDERS).unwrap_or_else(|| Map::new(&env));
        let tender = tenders.get(tender_id).expect("tender not found");
        assert!(tender.status == TenderStatus::Open, "tender is not open");

        // Prevent duplicate bids: one bid per contractor per tender
        let bids: Map<u32, Bid> = storage.get(&BIDS).unwrap_or_else(|| Map::new(&env));
        let idx: Map<u32, Vec<u32>> = storage.get(&TENDER_BIDS).unwrap_or_else(|| Map::new(&env));
        let existing_ids = idx.get(tender_id).unwrap_or_else(|| Vec::new(&env));
        for i in 0..existing_ids.len() {
            if let Some(bid_id) = existing_ids.get(i) {
                if let Some(existing_bid) = bids.get(bid_id) {
                    assert!(
                        existing_bid.contractor != contractor,
                        "contractor has already submitted a bid for this tender"
                    );
                }
            }
        }

        // Pull real reputation score from the reputation contract (cross-contract call)
        let reputation_address: Address = storage.get(&REPUTATION).expect("reputation not configured");
        let reputation_client = ReputationClient::new(&env, &reputation_address);
        let reputation_score: u32 = match reputation_client.get_reputation(&contractor) {
            Some(record) => record.reputation_score,
            None => 0,
        };

        let price_score = if price > 0 {
            let discount = (tender.budget.saturating_sub(price).saturating_mul(50_i128)) / tender.budget;
            discount.min(50) as u32
        } else { 0u32 };

        let quality_weighted = quality_score.min(100).saturating_mul(30) / 100;
        let timeline_score = if timeline_days > 0 {
            (100u32.saturating_sub(timeline_days.min(365).saturating_mul(10))).min(20)
        } else { 20u32 };

        let integrity_score = reputation_score.min(100).saturating_mul(20) / 100;
        let final_score = price_score.saturating_add(quality_weighted).saturating_add(timeline_score).saturating_add(integrity_score);

        let id = Self::next_id(&env);
        let bid = Bid {
            id,
            tender_id,
            contractor: contractor.clone(),
            price,
            quality_score: quality_score.min(100),
            timeline_days: timeline_days.min(365),
            reputation_score: reputation_score.min(100),
            final_score,
            timestamp: env.ledger().timestamp(),
        };

        let mut bids: Map<u32, Bid> = storage.get(&BIDS).unwrap_or_else(|| Map::new(&env));
        bids.set(id, bid);
        storage.set(&BIDS, &bids);

        let mut idx: Map<u32, Vec<u32>> = storage.get(&TENDER_BIDS).unwrap_or_else(|| Map::new(&env));
        let mut ids = idx.get(tender_id).unwrap_or_else(|| Vec::new(&env));
        ids.push_back(id);
        idx.set(tender_id, ids);
        storage.set(&TENDER_BIDS, &idx);

        BidSubmittedEvent { id, tender_id, contractor, final_score }.publish(&env);
        id
    }

    pub fn award_tender(env: Env, agency: Address, tender_id: u32) {
        agency.require_auth();

        let storage = env.storage().persistent();
        let mut tenders: Map<u32, Tender> = storage.get(&TENDERS).unwrap_or_else(|| Map::new(&env));
        let mut tender = tenders.get(tender_id).expect("tender not found");
        assert!(tender.status == TenderStatus::Open || tender.status == TenderStatus::Closed, "cannot award");

        let bids: Map<u32, Bid> = storage.get(&BIDS).unwrap_or_else(|| Map::new(&env));
        let idx: Map<u32, Vec<u32>> = storage.get(&TENDER_BIDS).unwrap_or_else(|| Map::new(&env));
        let ids = idx.get(tender_id).unwrap_or_else(|| Vec::new(&env));

        let min_bids: u32 = storage.get(&MIN_BIDS).unwrap_or(1);
        assert!(ids.len() >= min_bids as u32, "insufficient bids: requires at least {}", min_bids);

        let mut best_score = 0u32;
        let mut winner: Option<Address> = None;

        for i in 0..ids.len() {
            if let Some(bid_id) = ids.get(i) {
                if let Some(bid) = bids.get(bid_id) {
                    if bid.final_score > best_score {
                        best_score = bid.final_score;
                        winner = Some(bid.contractor);
                    }
                }
            }
        }

        assert!(winner.is_some(), "no bids to award");
        let w = winner.unwrap();
        let pvo_id = tender.pvo_id; // capture before move
        tender.status = TenderStatus::Awarded;
        tender.winner = Some(w.clone());
        tenders.set(tender_id, tender);
        storage.set(&TENDERS, &tenders);

        TenderAwardedEvent { tender_id, winner: w.clone(), final_score: best_score }.publish(&env);

        // Auto-assign winner as contractor on the PVO
        if pvo_id > 0 {
            if let Some(pvo_core_addr) = storage.get::<Symbol, Address>(&PVO_CORE_ADDR) {
                let _: () = env.invoke_contract(
                    &pvo_core_addr,
                    &Symbol::new(&env, "assign_contractor"),
                    soroban_sdk::vec![
                        &env,
                        env.current_contract_address().into_val(&env),
                        pvo_id.into(),
                        w.into_val(&env),
                    ],
                );
            }
        }
    }

    // ─── Queries ───

    pub fn get_tender(env: Env, id: u32) -> Option<Tender> {
        let storage = env.storage().persistent();
        let tenders: Map<u32, Tender> = storage.get(&TENDERS).unwrap_or_else(|| Map::new(&env));
        tenders.get(id)
    }

    pub fn get_bids_by_tender(env: Env, tender_id: u32) -> Vec<Bid> {
        let storage = env.storage().persistent();
        let bids: Map<u32, Bid> = storage.get(&BIDS).unwrap_or_else(|| Map::new(&env));
        let idx: Map<u32, Vec<u32>> = storage.get(&TENDER_BIDS).unwrap_or_else(|| Map::new(&env));
        let ids = idx.get(tender_id).unwrap_or_else(|| Vec::new(&env));

        let mut result: Vec<Bid> = Vec::new(&env);
        for i in 0..ids.len() {
            if let Some(id) = ids.get(i) {
                if let Some(b) = bids.get(id) {
                    result.push_back(b);
                }
            }
        }
        result
    }

    pub fn get_tender_count(env: Env) -> u32 {
        let storage = env.storage().persistent();
        let tenders: Map<u32, Tender> = storage.get(&TENDERS).unwrap_or_else(|| Map::new(&env));
        tenders.len() as u32
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
