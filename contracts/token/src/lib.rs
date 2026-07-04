#![no_std]

use soroban_sdk::token::TokenInterface;
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Map, MuxedAddress, String, Symbol};

const ADMIN: Symbol = symbol_short!("ADMIN");
const DECIMALS: Symbol = symbol_short!("DECIMALS");
const NAME: Symbol = symbol_short!("NAME");
const SYMBOL: Symbol = symbol_short!("SYMBOL");
const BALANCES: Symbol = symbol_short!("BALANCES");
const ALLOWANCES: Symbol = symbol_short!("ALLOW");
const TOTAL_SUPPLY: Symbol = symbol_short!("TSUPPLY");
const INITIALIZED: Symbol = symbol_short!("INIT");

#[contracttype]
#[derive(Clone)]
pub struct AllowanceData {
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contract]
pub struct PphpToken;

#[contractimpl]
impl PphpToken {
    pub fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String) {
        let storage = env.storage().persistent();
        if storage.has(&INITIALIZED) {
            panic!("already initialized");
        }
        storage.set(&ADMIN, &admin);
        storage.set(&DECIMALS, &decimal);
        storage.set(&NAME, &name);
        storage.set(&SYMBOL, &symbol);
        storage.set(&TOTAL_SUPPLY, &0i128);
        storage.set(&BALANCES, &Map::<Address, i128>::new(&env));
        storage.set(&ALLOWANCES, &Map::<Address, Map<Address, AllowanceData>>::new(&env));
        storage.set(&INITIALIZED, &true);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let storage = env.storage().persistent();
        let admin: Address = storage.get(&ADMIN).unwrap_or_else(|| panic!("not initialized"));
        admin.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let mut balances: Map<Address, i128> = storage.get(&BALANCES).unwrap();
        let current = balances.get(to.clone()).unwrap_or(0);
        balances.set(to.clone(), current + amount);
        storage.set(&BALANCES, &balances);

        let mut supply: i128 = storage.get(&TOTAL_SUPPLY).unwrap();
        supply += amount;
        storage.set(&TOTAL_SUPPLY, &supply);
    }

    pub fn admin(env: Env) -> Address {
        env.storage().persistent().get(&ADMIN).unwrap_or_else(|| panic!("not initialized"))
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().persistent().get(&TOTAL_SUPPLY).unwrap_or(0)
    }
}

fn read_balance(env: &Env, id: &Address) -> i128 {
    let balances: Map<Address, i128> = env.storage().persistent().get(&BALANCES).unwrap_or_else(|| Map::new(env));
    balances.get(id.clone()).unwrap_or(0)
}

fn write_balance(env: &Env, id: &Address, amount: i128) {
    let mut balances: Map<Address, i128> = env.storage().persistent().get(&BALANCES).unwrap_or_else(|| Map::new(env));
    balances.set(id.clone(), amount);
    env.storage().persistent().set(&BALANCES, &balances);
}

fn read_allowance(env: &Env, from: &Address, spender: &Address) -> AllowanceData {
    let allowances: Map<Address, Map<Address, AllowanceData>> =
        env.storage().persistent().get(&ALLOWANCES).unwrap_or_else(|| Map::new(env));
    let inner = allowances.get(from.clone()).unwrap_or_else(|| Map::new(env));
    inner.get(spender.clone()).unwrap_or(AllowanceData { amount: 0, expiration_ledger: 0 })
}

fn write_allowance(env: &Env, from: &Address, spender: &Address, data: AllowanceData) {
    let mut allowances: Map<Address, Map<Address, AllowanceData>> =
        env.storage().persistent().get(&ALLOWANCES).unwrap_or_else(|| Map::new(env));
    let mut inner = allowances.get(from.clone()).unwrap_or_else(|| Map::new(env));
    inner.set(spender.clone(), data);
    allowances.set(from.clone(), inner);
    env.storage().persistent().set(&ALLOWANCES, &allowances);
}

fn is_expired(env: &Env, expiration_ledger: u32) -> bool {
    expiration_ledger != 0 && env.ledger().sequence() >= expiration_ledger
}

fn spend_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    let allowance = read_allowance(env, from, spender);
    if is_expired(env, allowance.expiration_ledger) {
        panic!("allowance expired");
    }
    if allowance.amount < amount {
        panic!("insufficient allowance");
    }
    let new_amount = allowance.amount - amount;
    write_allowance(env, from, spender, AllowanceData {
        amount: new_amount,
        expiration_ledger: allowance.expiration_ledger,
    });
}

#[contractimpl]
impl TokenInterface for PphpToken {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let allowance = read_allowance(&env, &from, &spender);
        if is_expired(&env, allowance.expiration_ledger) {
            return 0;
        }
        allowance.amount
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        if expiration_ledger != 0 && env.ledger().sequence() >= expiration_ledger {
            panic!("expiration must be in the future");
        }
        write_allowance(&env, &from, &spender, AllowanceData { amount, expiration_ledger });
    }

    fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, &id)
    }

    fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128) {
        from.require_auth();
        let to = to.address();
        let from_balance = read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        write_balance(&env, &from, from_balance - amount);
        let to_balance = read_balance(&env, &to);
        write_balance(&env, &to, to_balance + amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        spend_allowance(&env, &from, &spender, amount);
        let from_balance = read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        write_balance(&env, &from, from_balance - amount);
        let to_balance = read_balance(&env, &to);
        write_balance(&env, &to, to_balance + amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let from_balance = read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        write_balance(&env, &from, from_balance - amount);
        let mut supply: i128 = env.storage().persistent().get(&TOTAL_SUPPLY).unwrap();
        supply -= amount;
        env.storage().persistent().set(&TOTAL_SUPPLY, &supply);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        spend_allowance(&env, &from, &spender, amount);
        let from_balance = read_balance(&env, &from);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        write_balance(&env, &from, from_balance - amount);
        let mut supply: i128 = env.storage().persistent().get(&TOTAL_SUPPLY).unwrap();
        supply -= amount;
        env.storage().persistent().set(&TOTAL_SUPPLY, &supply);
    }

    fn decimals(env: Env) -> u32 {
        env.storage().persistent().get(&DECIMALS).unwrap_or(0)
    }

    fn name(env: Env) -> String {
        env.storage().persistent().get(&NAME).unwrap_or_else(|| String::from_str(&env, "Unknown"))
    }

    fn symbol(env: Env) -> String {
        env.storage().persistent().get(&SYMBOL).unwrap_or_else(|| String::from_str(&env, "UNK"))
    }
}
