#!/bin/bash
set -euo pipefail

# PoPV Contract Deployment Script
# Deploys all 7 contracts to Stellar testnet, initializes them, and saves aliases.

export PATH="$PATH:$HOME/.local/bin"

NETWORK="testnet"
SOURCE="alice"
ALICE_ADDR="GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV"
WASM_DIR="target/wasm32v1-none/release"

CONTRACTS=(
  "access_control"
  "audit_trail"
  "community_oracle"
  "escrow"
  "pvo_core"
  "reputation"
  "value_score"
  "ai_oracle"
)

echo "============================================"
echo "  PoPV Testnet Deployment"
echo "============================================"
echo ""

# Step 1: Build all contracts
echo "[1/4] Building contracts..."
stellar contract build
echo ""

# Step 2: Deploy each contract
echo "[2/4] Deploying contracts..."
declare -A CONTRACT_IDS
for contract in "${CONTRACTS[@]}"; do
  echo -n "  Deploying $contract... "
  CONTRACT_ID=$(stellar contract deploy \
    --source "$SOURCE" \
    --network "$NETWORK" \
    --wasm "$WASM_DIR/$contract.wasm" 2>&1 | tail -1)
  CONTRACT_IDS[$contract]="$CONTRACT_ID"
  echo "$CONTRACT_ID"
done
echo ""

# Step 3: Save aliases
echo "[3/4] Saving aliases..."
for contract in "${CONTRACTS[@]}"; do
  stellar contract alias add "$contract" \
    --id "${CONTRACT_IDS[$contract]}" \
    --network "$NETWORK" \
    --overwrite 2>&1 | tail -1
done
echo ""

# Step 4: Initialize all contracts
echo "[4/4] Initializing contracts..."

echo -n "  access_control... "
stellar contract invoke --source "$SOURCE" --network "$NETWORK" \
  --id access_control -- initialize --admin "$ALICE_ADDR" 2>&1 | tail -1

for contract in audit_trail community_oracle escrow pvo_core reputation value_score; do
  echo -n "  $contract... "
  stellar contract invoke --source "$SOURCE" --network "$NETWORK" \
    --id "$contract" -- initialize 2>&1 | tail -1
done
echo ""

echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "Contract IDs:"
for contract in "${CONTRACTS[@]}"; do
  printf "  %-20s %s\n" "$contract:" "${CONTRACT_IDS[$contract]}"
done
echo ""
echo "Verify on Stellar Expert:"
echo "  https://stellar.expert/explorer/testnet"
