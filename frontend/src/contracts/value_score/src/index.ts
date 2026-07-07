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
    contractId: "CBR3TNBTULT6UYAPCC6PZMAU2EWRO737VZLHICARMBAIQILJQRFTQ5BD",
  }
} as const


export interface PVOScore {
  category_scores: Array<CategoryScore>;
  last_updated: u64;
  overall_score: u32;
  pvo_id: u32;
  total_evaluations: u32;
}


export interface IndexEntry {
  avg_score: u32;
  department: string;
  pvo_count: u32;
}


export interface CategoryScore {
  category: ScoreCategory;
  evaluator: string;
  score: u32;
  timestamp: u64;
  weight: u32;
}

export type ScoreCategory = {tag: "EngineeringQuality", values: void} | {tag: "BudgetEfficiency", values: void} | {tag: "SchedulePerformance", values: void} | {tag: "EnvironmentalImpact", values: void} | {tag: "Safety", values: void} | {tag: "FloodReduction", values: void} | {tag: "CitizenSatisfaction", values: void} | {tag: "Transparency", values: void} | {tag: "Compliance", values: void} | {tag: "MaintenanceReadiness", values: void};



export interface Client {
  /**
   * Construct and simulate a get_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_score: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PVOScore>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a submit_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_score: ({evaluator, pvo_id, category, score, weight}: {evaluator: string, pvo_id: u32, category: ScoreCategory, score: u32, weight: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_overall_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_overall_score: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_category_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_category_score: ({pvo_id, category}: {pvo_id: u32, category: ScoreCategory}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CategoryScore>>>

  /**
   * Construct and simulate a get_top_departments transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_top_departments: ({count}: {count: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<IndexEntry>>>

  /**
   * Construct and simulate a get_department_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_department_index: ({department}: {department: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<IndexEntry>>>

  /**
   * Construct and simulate a get_scored_pvo_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_scored_pvo_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a update_department_index transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_department_index: ({caller, department, pvo_id}: {caller: string, department: string, pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a calculate_weighted_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  calculate_weighted_score: ({pvo_score}: {pvo_score: PVOScore}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_all_department_indices transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_all_department_indices: (options?: MethodOptions) => Promise<AssembledTransaction<Array<IndexEntry>>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAACFBWT1Njb3JlAAAABQAAAAAAAAAPY2F0ZWdvcnlfc2NvcmVzAAAAA+oAAAfQAAAADUNhdGVnb3J5U2NvcmUAAAAAAAAAAAAADGxhc3RfdXBkYXRlZAAAAAYAAAAAAAAADW92ZXJhbGxfc2NvcmUAAAAAAAAEAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAAEXRvdGFsX2V2YWx1YXRpb25zAAAAAAAABA==",
        "AAAAAQAAAAAAAAAAAAAACkluZGV4RW50cnkAAAAAAAMAAAAAAAAACWF2Z19zY29yZQAAAAAAAAQAAAAAAAAACmRlcGFydG1lbnQAAAAAABAAAAAAAAAACXB2b19jb3VudAAAAAAAAAQ=",
        "AAAAAQAAAAAAAAAAAAAADUNhdGVnb3J5U2NvcmUAAAAAAAAFAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAANU2NvcmVDYXRlZ29yeQAAAAAAAAAAAAAJZXZhbHVhdG9yAAAAAAAAEwAAAAAAAAAFc2NvcmUAAAAAAAAEAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAAAAAAZ3ZWlnaHQAAAAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAADVNjb3JlQ2F0ZWdvcnkAAAAAAAAKAAAAAAAAAAAAAAASRW5naW5lZXJpbmdRdWFsaXR5AAAAAAAAAAAAAAAAABBCdWRnZXRFZmZpY2llbmN5AAAAAAAAAAAAAAATU2NoZWR1bGVQZXJmb3JtYW5jZQAAAAAAAAAAAAAAABNFbnZpcm9ubWVudGFsSW1wYWN0AAAAAAAAAAAAAAAABlNhZmV0eQAAAAAAAAAAAAAAAAAORmxvb2RSZWR1Y3Rpb24AAAAAAAAAAAAAAAAAE0NpdGl6ZW5TYXRpc2ZhY3Rpb24AAAAAAAAAAAAAAAAMVHJhbnNwYXJlbmN5AAAAAAAAAAAAAAAKQ29tcGxpYW5jZQAAAAAAAAAAAAAAAAAUTWFpbnRlbmFuY2VSZWFkaW5lc3M=",
        "AAAAAAAAAAAAAAAJZ2V0X3Njb3JlAAAAAAAAAQAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAQAAA+gAAAfQAAAACFBWT1Njb3Jl",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAAMc3VibWl0X3Njb3JlAAAABQAAAAAAAAAJZXZhbHVhdG9yAAAAAAAAEwAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAhjYXRlZ29yeQAAB9AAAAANU2NvcmVDYXRlZ29yeQAAAAAAAAAAAAAFc2NvcmUAAAAAAAAEAAAAAAAAAAZ3ZWlnaHQAAAAAAAQAAAAA",
        "AAAABQAAAAAAAAAAAAAAEUluZGV4VXBkYXRlZEV2ZW50AAAAAAAAAQAAABNpbmRleF91cGRhdGVkX2V2ZW50AAAAAAIAAAAAAAAACmRlcGFydG1lbnQAAAAAABAAAAAAAAAAAAAAAAlhdmdfc2NvcmUAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAEVNjb3JlVXBkYXRlZEV2ZW50AAAAAAAAAQAAABNzY29yZV91cGRhdGVkX2V2ZW50AAAAAAIAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAAAAAADW92ZXJhbGxfc2NvcmUAAAAAAAAEAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAARZ2V0X292ZXJhbGxfc2NvcmUAAAAAAAABAAAAAAAAAAZwdm9faWQAAAAAAAQAAAABAAAABA==",
        "AAAAAAAAAAAAAAASZ2V0X2NhdGVnb3J5X3Njb3JlAAAAAAACAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAACGNhdGVnb3J5AAAH0AAAAA1TY29yZUNhdGVnb3J5AAAAAAAAAQAAA+gAAAfQAAAADUNhdGVnb3J5U2NvcmUAAAA=",
        "AAAAAAAAAAAAAAATZ2V0X3RvcF9kZXBhcnRtZW50cwAAAAABAAAAAAAAAAVjb3VudAAAAAAAAAQAAAABAAAD6gAAB9AAAAAKSW5kZXhFbnRyeQAA",
        "AAAAAAAAAAAAAAAUZ2V0X2RlcGFydG1lbnRfaW5kZXgAAAABAAAAAAAAAApkZXBhcnRtZW50AAAAAAAQAAAAAQAAA+gAAAfQAAAACkluZGV4RW50cnkAAA==",
        "AAAAAAAAAAAAAAAUZ2V0X3Njb3JlZF9wdm9fY291bnQAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAXdXBkYXRlX2RlcGFydG1lbnRfaW5kZXgAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAApkZXBhcnRtZW50AAAAAAAQAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAYY2FsY3VsYXRlX3dlaWdodGVkX3Njb3JlAAAAAQAAAAAAAAAJcHZvX3Njb3JlAAAAAAAH0AAAAAhQVk9TY29yZQAAAAEAAAAE",
        "AAAAAAAAAAAAAAAaZ2V0X2FsbF9kZXBhcnRtZW50X2luZGljZXMAAAAAAAAAAAABAAAD6gAAB9AAAAAKSW5kZXhFbnRyeQAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_score: this.txFromJSON<Option<PVOScore>>,
        initialize: this.txFromJSON<null>,
        submit_score: this.txFromJSON<null>,
        get_overall_score: this.txFromJSON<u32>,
        get_category_score: this.txFromJSON<Option<CategoryScore>>,
        get_top_departments: this.txFromJSON<Array<IndexEntry>>,
        get_department_index: this.txFromJSON<Option<IndexEntry>>,
        get_scored_pvo_count: this.txFromJSON<u32>,
        update_department_index: this.txFromJSON<null>,
        calculate_weighted_score: this.txFromJSON<u32>,
        get_all_department_indices: this.txFromJSON<Array<IndexEntry>>
  }
}