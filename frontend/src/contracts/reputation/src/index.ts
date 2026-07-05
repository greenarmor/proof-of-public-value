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
    contractId: "CDWMWDIVX5I2C2XH42WVEVA5JXW6HAWYRRLWSMYZHTO3OMEJRZ6EVVLU",
  }
} as const

export type EntityType = {tag: "GovernmentAgency", values: void} | {tag: "Municipality", values: void} | {tag: "Contractor", values: void} | {tag: "Engineer", values: void} | {tag: "Inspector", values: void} | {tag: "Supplier", values: void} | {tag: "Consultant", values: void} | {tag: "Auditor", values: void};


export interface ComplaintRecord {
  category: string;
  complainant: string;
  description: string;
  entity: string;
  id: u32;
  severity: u32;
  timestamp: u64;
  verified: boolean;
}


export interface ReputationRecord {
  audit_findings: u32;
  average_value_score: u32;
  budget_overruns: u32;
  community_complaints: u32;
  completed_projects: u32;
  delayed_projects: u32;
  entity: string;
  entity_type: EntityType;
  id: u32;
  last_updated: u64;
  legal_cases: u32;
  reputation_score: u32;
  safety_violations: u32;
  success_rate: u32;
}





export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_complaint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_complaint: ({complaint_id}: {complaint_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ComplaintRecord>>>

  /**
   * Construct and simulate a file_complaint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  file_complaint: ({complainant, entity, category, description, severity}: {complainant: string, entity: string, category: string, description: string, severity: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reputation: ({entity}: {entity: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ReputationRecord>>>

  /**
   * Construct and simulate a register_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_entity: ({entity, entity_type}: {entity: string, entity_type: EntityType}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_entity_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entity_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a verify_complaint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_complaint: ({caller, complaint_id}: {caller: string, complaint_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a record_completion transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_completion: ({caller, entity, value_score, on_time, within_budget}: {caller: string, entity: string, value_score: u32, on_time: boolean, within_budget: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a record_audit_finding transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_audit_finding: ({caller, entity, severity}: {caller: string, entity: string, severity: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a record_safety_violation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_safety_violation: ({caller, entity, severity}: {caller: string, entity: string, severity: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_complaints_by_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_complaints_by_entity: ({entity}: {entity: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<ComplaintRecord>>>

  /**
   * Construct and simulate a get_entities_by_reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entities_by_reputation: ({entity_type, min_score}: {entity_type: EntityType, min_score: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

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
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAACkVudGl0eVR5cGUAAAAAAAgAAAAAAAAAAAAAABBHb3Zlcm5tZW50QWdlbmN5AAAAAAAAAAAAAAAMTXVuaWNpcGFsaXR5AAAAAAAAAAAAAAAKQ29udHJhY3RvcgAAAAAAAAAAAAAAAAAIRW5naW5lZXIAAAAAAAAAAAAAAAlJbnNwZWN0b3IAAAAAAAAAAAAAAAAAAAhTdXBwbGllcgAAAAAAAAAAAAAACkNvbnN1bHRhbnQAAAAAAAAAAAAAAAAAB0F1ZGl0b3IA",
        "AAAAAQAAAAAAAAAAAAAAD0NvbXBsYWludFJlY29yZAAAAAAIAAAAAAAAAAhjYXRlZ29yeQAAABAAAAAAAAAAC2NvbXBsYWluYW50AAAAABMAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAABmVudGl0eQAAAAAAEwAAAAAAAAACaWQAAAAAAAQAAAAAAAAACHNldmVyaXR5AAAABAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAIdmVyaWZpZWQAAAAB",
        "AAAAAQAAAAAAAAAAAAAAEFJlcHV0YXRpb25SZWNvcmQAAAAOAAAAAAAAAA5hdWRpdF9maW5kaW5ncwAAAAAABAAAAAAAAAATYXZlcmFnZV92YWx1ZV9zY29yZQAAAAAEAAAAAAAAAA9idWRnZXRfb3ZlcnJ1bnMAAAAABAAAAAAAAAAUY29tbXVuaXR5X2NvbXBsYWludHMAAAAEAAAAAAAAABJjb21wbGV0ZWRfcHJvamVjdHMAAAAAAAQAAAAAAAAAEGRlbGF5ZWRfcHJvamVjdHMAAAAEAAAAAAAAAAZlbnRpdHkAAAAAABMAAAAAAAAAC2VudGl0eV90eXBlAAAAB9AAAAAKRW50aXR5VHlwZQAAAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAMbGFzdF91cGRhdGVkAAAABgAAAAAAAAALbGVnYWxfY2FzZXMAAAAABAAAAAAAAAAQcmVwdXRhdGlvbl9zY29yZQAAAAQAAAAAAAAAEXNhZmV0eV92aW9sYXRpb25zAAAAAAAABAAAAAAAAAAMc3VjY2Vzc19yYXRlAAAABA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAABQAAAAAAAAAAAAAAE0NvbXBsYWludEZpbGVkRXZlbnQAAAAAAQAAABVjb21wbGFpbnRfZmlsZWRfZXZlbnQAAAAAAAADAAAAAAAAAAZlbnRpdHkAAAAAABMAAAAAAAAAAAAAAAtjb21wbGFpbmFudAAAAAATAAAAAAAAAAAAAAAIc2V2ZXJpdHkAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFUVudGl0eVJlZ2lzdGVyZWRFdmVudAAAAAAAAAEAAAAXZW50aXR5X3JlZ2lzdGVyZWRfZXZlbnQAAAAAAgAAAAAAAAAGZW50aXR5AAAAAAATAAAAAAAAAAAAAAALZW50aXR5X3R5cGUAAAAH0AAAAApFbnRpdHlUeXBlAAAAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAANZ2V0X2NvbXBsYWludAAAAAAAAAEAAAAAAAAADGNvbXBsYWludF9pZAAAAAQAAAABAAAD6AAAB9AAAAAPQ29tcGxhaW50UmVjb3JkAA==",
        "AAAABQAAAAAAAAAAAAAAFkNvbXBsYWludFZlcmlmaWVkRXZlbnQAAAAAAAEAAAAYY29tcGxhaW50X3ZlcmlmaWVkX2V2ZW50AAAAAQAAAAAAAAAMY29tcGxhaW50X2lkAAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFlJlcHV0YXRpb25VcGRhdGVkRXZlbnQAAAAAAAEAAAAYcmVwdXRhdGlvbl91cGRhdGVkX2V2ZW50AAAAAgAAAAAAAAAGZW50aXR5AAAAAAATAAAAAAAAAAAAAAAQcmVwdXRhdGlvbl9zY29yZQAAAAQAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAOZmlsZV9jb21wbGFpbnQAAAAAAAUAAAAAAAAAC2NvbXBsYWluYW50AAAAABMAAAAAAAAABmVudGl0eQAAAAAAEwAAAAAAAAAIY2F0ZWdvcnkAAAAQAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAhzZXZlcml0eQAAAAQAAAABAAAABA==",
        "AAAAAAAAAAAAAAAOZ2V0X3JlcHV0YXRpb24AAAAAAAEAAAAAAAAABmVudGl0eQAAAAAAEwAAAAEAAAPoAAAH0AAAABBSZXB1dGF0aW9uUmVjb3Jk",
        "AAAAAAAAAAAAAAAPcmVnaXN0ZXJfZW50aXR5AAAAAAIAAAAAAAAABmVudGl0eQAAAAAAEwAAAAAAAAALZW50aXR5X3R5cGUAAAAH0AAAAApFbnRpdHlUeXBlAAAAAAAA",
        "AAAAAAAAAAAAAAAQZ2V0X2VudGl0eV9jb3VudAAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAAQdmVyaWZ5X2NvbXBsYWludAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAMY29tcGxhaW50X2lkAAAABAAAAAA=",
        "AAAAAAAAAAAAAAARcmVjb3JkX2NvbXBsZXRpb24AAAAAAAAFAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABmVudGl0eQAAAAAAEwAAAAAAAAALdmFsdWVfc2NvcmUAAAAABAAAAAAAAAAHb25fdGltZQAAAAABAAAAAAAAAA13aXRoaW5fYnVkZ2V0AAAAAAAAAQAAAAA=",
        "AAAAAAAAAAAAAAAUcmVjb3JkX2F1ZGl0X2ZpbmRpbmcAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAABmVudGl0eQAAAAAAEwAAAAAAAAAIc2V2ZXJpdHkAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAAXcmVjb3JkX3NhZmV0eV92aW9sYXRpb24AAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZlbnRpdHkAAAAAABMAAAAAAAAACHNldmVyaXR5AAAABAAAAAA=",
        "AAAAAAAAAAAAAAAYZ2V0X2NvbXBsYWludHNfYnlfZW50aXR5AAAAAQAAAAAAAAAGZW50aXR5AAAAAAATAAAAAQAAA+oAAAfQAAAAD0NvbXBsYWludFJlY29yZAA=",
        "AAAAAAAAAAAAAAAaZ2V0X2VudGl0aWVzX2J5X3JlcHV0YXRpb24AAAAAAAIAAAAAAAAAC2VudGl0eV90eXBlAAAAB9AAAAAKRW50aXR5VHlwZQAAAAAAAAAAAAltaW5fc2NvcmUAAAAAAAAEAAAAAQAAA+oAAAAT" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<null>,
        get_complaint: this.txFromJSON<Option<ComplaintRecord>>,
        file_complaint: this.txFromJSON<u32>,
        get_reputation: this.txFromJSON<Option<ReputationRecord>>,
        register_entity: this.txFromJSON<null>,
        get_entity_count: this.txFromJSON<u32>,
        verify_complaint: this.txFromJSON<null>,
        record_completion: this.txFromJSON<null>,
        record_audit_finding: this.txFromJSON<null>,
        record_safety_violation: this.txFromJSON<null>,
        get_complaints_by_entity: this.txFromJSON<Array<ComplaintRecord>>,
        get_entities_by_reputation: this.txFromJSON<Array<string>>
  }
}