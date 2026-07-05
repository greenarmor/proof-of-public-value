import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCDRYCDA7J77I36D66HRMOO2JQZXLMXLHKG43KLQHZUCB5E4DXKUXGRW",
  }
} as const


export interface Escrow {
  amount: i128;
  conditions: UnlockCondition;
  created_at: u64;
  funder: string;
  id: u32;
  milestone_id: u32;
  pvo_id: u32;
  recipient: string;
  released_at: u64;
  status: EscrowStatus;
  token_address: string;
}

export type EscrowStatus = {tag: "Created", values: void} | {tag: "Funded", values: void} | {tag: "EngineerApproved", values: void} | {tag: "AIValidated", values: void} | {tag: "CompliancePassed", values: void} | {tag: "OracleValidated", values: void} | {tag: "CommunityVerified", values: void} | {tag: "Ready", values: void} | {tag: "Released", values: void} | {tag: "Refunded", values: void} | {tag: "Disputed", values: void};


export interface UnlockCondition {
  ai_risk_check: boolean;
  community_confirmation: u32;
  community_oracle_validation: boolean;
  community_required: u32;
  compliance_validation: boolean;
  engineer_approval: boolean;
}







export interface Client {
  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  refund: ({funder, escrow_id}: {funder: string, escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  dispute: ({disputer, escrow_id}: {disputer: string, escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release: ({caller, escrow_id}: {caller: string, escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: ({escrow_id}: {escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Escrow>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({compliance_engine, community_oracle}: {compliance_engine: string, community_oracle: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a ai_validate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  ai_validate: ({auditor, escrow_id, passed}: {auditor: string, escrow_id: u32, passed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a fund_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  fund_escrow: ({funder, escrow_id, amount}: {funder: string, escrow_id: u32, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_escrow: ({funder, recipient, pvo_id, milestone_id, amount, token_address, community_required}: {funder: string, recipient: string, pvo_id: u32, milestone_id: u32, amount: i128, token_address: string, community_required: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a check_conditions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  check_conditions: ({escrow_id}: {escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a engineer_approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  engineer_approve: ({engineer, escrow_id}: {engineer: string, escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_escrow_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_escrows_by_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrows_by_pvo: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Escrow>>>

  /**
   * Construct and simulate a compliance_validate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  compliance_validate: ({compliance_officer, escrow_id, passed}: {compliance_officer: string, escrow_id: u32, passed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a community_oracle_validate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  community_oracle_validate: ({citizen, escrow_id}: {citizen: string, escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a add_community_confirmation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_community_confirmation: ({citizen, escrow_id}: {citizen: string, escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABkVzY3JvdwAAAAAACwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAApjb25kaXRpb25zAAAAAAfQAAAAD1VubG9ja0NvbmRpdGlvbgAAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAAAAAACaWQAAAAAAAQAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAALcmVsZWFzZWRfYXQAAAAABgAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADEVzY3Jvd1N0YXR1cwAAAAAAAAANdG9rZW5fYWRkcmVzcwAAAAAAABM=",
        "AAAAAgAAAAAAAAAAAAAADEVzY3Jvd1N0YXR1cwAAAAsAAAAAAAAAAAAAAAdDcmVhdGVkAAAAAAAAAAAAAAAABkZ1bmRlZAAAAAAAAAAAAAAAAAAQRW5naW5lZXJBcHByb3ZlZAAAAAAAAAAAAAAAC0FJVmFsaWRhdGVkAAAAAAAAAAAAAAAAEENvbXBsaWFuY2VQYXNzZWQAAAAAAAAAAAAAAA9PcmFjbGVWYWxpZGF0ZWQAAAAAAAAAAAAAAAARQ29tbXVuaXR5VmVyaWZpZWQAAAAAAAAAAAAAAAAAAAVSZWFkeQAAAAAAAAAAAAAAAAAACFJlbGVhc2VkAAAAAAAAAAAAAAAIUmVmdW5kZWQAAAAAAAAAAAAAAAhEaXNwdXRlZA==",
        "AAAAAAAAAAAAAAAGcmVmdW5kAAAAAAACAAAAAAAAAAZmdW5kZXIAAAAAABMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAHZGlzcHV0ZQAAAAACAAAAAAAAAAhkaXNwdXRlcgAAABMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAHcmVsZWFzZQAAAAACAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAABAAAAAQ==",
        "AAAAAQAAAAAAAAAAAAAAD1VubG9ja0NvbmRpdGlvbgAAAAAGAAAAAAAAAA1haV9yaXNrX2NoZWNrAAAAAAAAAQAAAAAAAAAWY29tbXVuaXR5X2NvbmZpcm1hdGlvbgAAAAAABAAAAAAAAAAbY29tbXVuaXR5X29yYWNsZV92YWxpZGF0aW9uAAAAAAEAAAAAAAAAEmNvbW11bml0eV9yZXF1aXJlZAAAAAAABAAAAAAAAAAVY29tcGxpYW5jZV92YWxpZGF0aW9uAAAAAAAAAQAAAAAAAAARZW5naW5lZXJfYXBwcm92YWwAAAAAAAAB",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAEAAAPoAAAH0AAAAAZFc2Nyb3cAAA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAARY29tcGxpYW5jZV9lbmdpbmUAAAAAAAATAAAAAAAAABBjb21tdW5pdHlfb3JhY2xlAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAALYWlfdmFsaWRhdGUAAAAAAwAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAAAAAAZwYXNzZWQAAAAAAAEAAAAA",
        "AAAAAAAAAAAAAAALZnVuZF9lc2Nyb3cAAAAAAwAAAAAAAAAGZnVuZGVyAAAAAAATAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAABQAAAAAAAAAAAAAAEUVzY3Jvd0Z1bmRlZEV2ZW50AAAAAAAAAQAAABNlc2Nyb3dfZnVuZGVkX2V2ZW50AAAAAAIAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAEkVzY3Jvd0NyZWF0ZWRFdmVudAAAAAAAAQAAABRlc2Nyb3dfY3JlYXRlZF9ldmVudAAAAAUAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAANY3JlYXRlX2VzY3JvdwAAAAAAAAcAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAADXRva2VuX2FkZHJlc3MAAAAAAAATAAAAAAAAABJjb21tdW5pdHlfcmVxdWlyZWQAAAAAAAQAAAABAAAABA==",
        "AAAABQAAAAAAAAAAAAAAE0VzY3Jvd0Rpc3B1dGVkRXZlbnQAAAAAAQAAABVlc2Nyb3dfZGlzcHV0ZWRfZXZlbnQAAAAAAAACAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAAAAAACGRpc3B1dGVyAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAE0VzY3Jvd1JlZnVuZGVkRXZlbnQAAAAAAQAAABVlc2Nyb3dfcmVmdW5kZWRfZXZlbnQAAAAAAAADAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAABmZ1bmRlcgAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAE0VzY3Jvd1JlbGVhc2VkRXZlbnQAAAAAAQAAABVlc2Nyb3dfcmVsZWFzZWRfZXZlbnQAAAAAAAADAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAQY2hlY2tfY29uZGl0aW9ucwAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAQZW5naW5lZXJfYXBwcm92ZQAAAAIAAAAAAAAACGVuZ2luZWVyAAAAEwAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAQZ2V0X2VzY3Jvd19jb3VudAAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAASZ2V0X2VzY3Jvd3NfYnlfcHZvAAAAAAABAAAAAAAAAAZwdm9faWQAAAAAAAQAAAABAAAD6gAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAATY29tcGxpYW5jZV92YWxpZGF0ZQAAAAADAAAAAAAAABJjb21wbGlhbmNlX29mZmljZXIAAAAAABMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAAAAAAABnBhc3NlZAAAAAAAAQAAAAA=",
        "AAAABQAAAAAAAAAAAAAAG0VzY3Jvd0NvbmRpdGlvblVwZGF0ZWRFdmVudAAAAAABAAAAHmVzY3Jvd19jb25kaXRpb25fdXBkYXRlZF9ldmVudAAAAAAAAgAAAAAAAAACaWQAAAAAAAQAAAAAAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRXNjcm93U3RhdHVzAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAZY29tbXVuaXR5X29yYWNsZV92YWxpZGF0ZQAAAAAAAAIAAAAAAAAAB2NpdGl6ZW4AAAAAEwAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAaYWRkX2NvbW11bml0eV9jb25maXJtYXRpb24AAAAAAAIAAAAAAAAAB2NpdGl6ZW4AAAAAEwAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    refund: this.txFromJSON<boolean>,
        dispute: this.txFromJSON<null>,
        release: this.txFromJSON<boolean>,
        get_escrow: this.txFromJSON<Option<Escrow>>,
        initialize: this.txFromJSON<null>,
        ai_validate: this.txFromJSON<null>,
        fund_escrow: this.txFromJSON<null>,
        create_escrow: this.txFromJSON<u32>,
        check_conditions: this.txFromJSON<boolean>,
        engineer_approve: this.txFromJSON<null>,
        get_escrow_count: this.txFromJSON<u32>,
        get_escrows_by_pvo: this.txFromJSON<Array<Escrow>>,
        compliance_validate: this.txFromJSON<null>,
        community_oracle_validate: this.txFromJSON<null>,
        add_community_confirmation: this.txFromJSON<null>
  }
}