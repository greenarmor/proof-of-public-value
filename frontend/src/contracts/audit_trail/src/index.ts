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
    contractId: "CCFCRX5MICL3NG56QNF7MQHXVGQJIDTUIXZN6KGGZIMXEGCCK4Z5C6YZ",
  }
} as const


export interface AuditEntry {
  action: string;
  actor: string;
  actor_role: string;
  ai_recommendation: string;
  block_height: u32;
  category: DecisionCategory;
  compliance_result: string;
  id: u32;
  pvo_id: u32;
  rationale: string;
  risk_score: u32;
  signature_hash: string;
  supporting_doc_hash: string;
  timestamp: u64;
}

export type DecisionCategory = {tag: "Approval", values: void} | {tag: "Payment", values: void} | {tag: "EvidenceReview", values: void} | {tag: "ComplianceCheck", values: void} | {tag: "AIRiskAssessment", values: void} | {tag: "ProcurementAward", values: void} | {tag: "ContractModification", values: void} | {tag: "DisputeResolution", values: void} | {tag: "MilestoneRelease", values: void} | {tag: "RoleChange", values: void};


export interface Client {
  /**
   * Construct and simulate a get_entry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entry: ({entry_id}: {entry_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<AuditEntry>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_entry_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entry_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a record_decision transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_decision: ({actor, pvo_id, category, action, rationale, supporting_doc_hash, ai_recommendation, risk_score, compliance_result, signature_hash}: {actor: string, pvo_id: u32, category: DecisionCategory, action: string, rationale: string, supporting_doc_hash: string, ai_recommendation: string, risk_score: u32, compliance_result: string, signature_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_pvo_entry_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pvo_entry_count: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_entries_by_actor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entries_by_actor: ({actor}: {actor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<AuditEntry>>>

  /**
   * Construct and simulate a get_high_risk_entries transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_high_risk_entries: ({min_risk_score}: {min_risk_score: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<AuditEntry>>>

  /**
   * Construct and simulate a get_pvo_audit_history transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pvo_audit_history: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<AuditEntry>>>

  /**
   * Construct and simulate a get_entries_by_category transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entries_by_category: ({category}: {category: DecisionCategory}, options?: MethodOptions) => Promise<AssembledTransaction<Array<AuditEntry>>>

  /**
   * Construct and simulate a record_decision_with_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  record_decision_with_role: ({actor, actor_role, pvo_id, category, action, rationale, supporting_doc_hash, ai_recommendation, risk_score, compliance_result, signature_hash}: {actor: string, actor_role: string, pvo_id: u32, category: DecisionCategory, action: string, rationale: string, supporting_doc_hash: string, ai_recommendation: string, risk_score: u32, compliance_result: string, signature_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAACkF1ZGl0RW50cnkAAAAAAA4AAAAAAAAABmFjdGlvbgAAAAAAEAAAAAAAAAAFYWN0b3IAAAAAAAATAAAAAAAAAAphY3Rvcl9yb2xlAAAAAAAQAAAAAAAAABFhaV9yZWNvbW1lbmRhdGlvbgAAAAAAABAAAAAAAAAADGJsb2NrX2hlaWdodAAAAAQAAAAAAAAACGNhdGVnb3J5AAAH0AAAABBEZWNpc2lvbkNhdGVnb3J5AAAAAAAAABFjb21wbGlhbmNlX3Jlc3VsdAAAAAAAABAAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAACXJhdGlvbmFsZQAAAAAAABAAAAAAAAAACnJpc2tfc2NvcmUAAAAAAAQAAAAAAAAADnNpZ25hdHVyZV9oYXNoAAAAAAAQAAAAAAAAABNzdXBwb3J0aW5nX2RvY19oYXNoAAAAABAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAY=",
        "AAAAAAAAAAAAAAAJZ2V0X2VudHJ5AAAAAAAAAQAAAAAAAAAIZW50cnlfaWQAAAAEAAAAAQAAA+gAAAfQAAAACkF1ZGl0RW50cnkAAA==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAAAgAAAAAAAAAAAAAAEERlY2lzaW9uQ2F0ZWdvcnkAAAAKAAAAAAAAAAAAAAAIQXBwcm92YWwAAAAAAAAAAAAAAAdQYXltZW50AAAAAAAAAAAAAAAADkV2aWRlbmNlUmV2aWV3AAAAAAAAAAAAAAAAAA9Db21wbGlhbmNlQ2hlY2sAAAAAAAAAAAAAAAAQQUlSaXNrQXNzZXNzbWVudAAAAAAAAAAAAAAAEFByb2N1cmVtZW50QXdhcmQAAAAAAAAAAAAAABRDb250cmFjdE1vZGlmaWNhdGlvbgAAAAAAAAAAAAAAEURpc3B1dGVSZXNvbHV0aW9uAAAAAAAAAAAAAAAAAAAQTWlsZXN0b25lUmVsZWFzZQAAAAAAAAAAAAAAClJvbGVDaGFuZ2UAAA==",
        "AAAAAAAAAAAAAAAPZ2V0X2VudHJ5X2NvdW50AAAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAAPcmVjb3JkX2RlY2lzaW9uAAAAAAoAAAAAAAAABWFjdG9yAAAAAAAAEwAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAQRGVjaXNpb25DYXRlZ29yeQAAAAAAAAAGYWN0aW9uAAAAAAAQAAAAAAAAAAlyYXRpb25hbGUAAAAAAAAQAAAAAAAAABNzdXBwb3J0aW5nX2RvY19oYXNoAAAAABAAAAAAAAAAEWFpX3JlY29tbWVuZGF0aW9uAAAAAAAAEAAAAAAAAAAKcmlza19zY29yZQAAAAAABAAAAAAAAAARY29tcGxpYW5jZV9yZXN1bHQAAAAAAAAQAAAAAAAAAA5zaWduYXR1cmVfaGFzaAAAAAAAEAAAAAEAAAAE",
        "AAAAAAAAAAAAAAATZ2V0X3B2b19lbnRyeV9jb3VudAAAAAABAAAAAAAAAAZwdm9faWQAAAAAAAQAAAABAAAABA==",
        "AAAABQAAAAAAAAAAAAAAFkF1ZGl0RW50cnlDcmVhdGVkRXZlbnQAAAAAAAEAAAAZYXVkaXRfZW50cnlfY3JlYXRlZF9ldmVudAAAAAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAAEERlY2lzaW9uQ2F0ZWdvcnkAAAAAAAAAAAAAAAVhY3RvcgAAAAAAABMAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAUZ2V0X2VudHJpZXNfYnlfYWN0b3IAAAABAAAAAAAAAAVhY3RvcgAAAAAAABMAAAABAAAD6gAAB9AAAAAKQXVkaXRFbnRyeQAA",
        "AAAAAAAAAAAAAAAVZ2V0X2hpZ2hfcmlza19lbnRyaWVzAAAAAAAAAQAAAAAAAAAObWluX3Jpc2tfc2NvcmUAAAAAAAQAAAABAAAD6gAAB9AAAAAKQXVkaXRFbnRyeQAA",
        "AAAAAAAAAAAAAAAVZ2V0X3B2b19hdWRpdF9oaXN0b3J5AAAAAAAAAQAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAQAAA+oAAAfQAAAACkF1ZGl0RW50cnkAAA==",
        "AAAAAAAAAAAAAAAXZ2V0X2VudHJpZXNfYnlfY2F0ZWdvcnkAAAAAAQAAAAAAAAAIY2F0ZWdvcnkAAAfQAAAAEERlY2lzaW9uQ2F0ZWdvcnkAAAABAAAD6gAAB9AAAAAKQXVkaXRFbnRyeQAA",
        "AAAAAAAAAAAAAAAZcmVjb3JkX2RlY2lzaW9uX3dpdGhfcm9sZQAAAAAAAAsAAAAAAAAABWFjdG9yAAAAAAAAEwAAAAAAAAAKYWN0b3Jfcm9sZQAAAAAAEAAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAAQRGVjaXNpb25DYXRlZ29yeQAAAAAAAAAGYWN0aW9uAAAAAAAQAAAAAAAAAAlyYXRpb25hbGUAAAAAAAAQAAAAAAAAABNzdXBwb3J0aW5nX2RvY19oYXNoAAAAABAAAAAAAAAAEWFpX3JlY29tbWVuZGF0aW9uAAAAAAAAEAAAAAAAAAAKcmlza19zY29yZQAAAAAABAAAAAAAAAARY29tcGxpYW5jZV9yZXN1bHQAAAAAAAAQAAAAAAAAAA5zaWduYXR1cmVfaGFzaAAAAAAAEAAAAAEAAAAE" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_entry: this.txFromJSON<Option<AuditEntry>>,
        initialize: this.txFromJSON<null>,
        get_entry_count: this.txFromJSON<u32>,
        record_decision: this.txFromJSON<u32>,
        get_pvo_entry_count: this.txFromJSON<u32>,
        get_entries_by_actor: this.txFromJSON<Array<AuditEntry>>,
        get_high_risk_entries: this.txFromJSON<Array<AuditEntry>>,
        get_pvo_audit_history: this.txFromJSON<Array<AuditEntry>>,
        get_entries_by_category: this.txFromJSON<Array<AuditEntry>>,
        record_decision_with_role: this.txFromJSON<u32>
  }
}