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
    contractId: "CCRICAAZXOXKD5ZKII32TTWIB3BJEXYWM55FEMUODP4CNRGMOIRNFQ2D",
  }
} as const


export interface NationalSnapshot {
  avg_value_score: u32;
  departments_ranked: u32;
  timestamp: u64;
  top_dept: string;
  top_dept_score: u32;
  total_budget: i128;
  total_pvos: u32;
}


export interface DepartmentBenchmark {
  avg_value_score: u32;
  completed_projects: u32;
  department: string;
  on_time_rate: u32;
  pvo_count: u32;
  rank: u32;
  total_budget: i128;
}



export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_benchmark transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_benchmark: ({department}: {department: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<DepartmentBenchmark>>>

  /**
   * Construct and simulate a get_all_benchmarks transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_all_benchmarks: (options?: MethodOptions) => Promise<AssembledTransaction<Array<DepartmentBenchmark>>>

  /**
   * Construct and simulate a get_latest_snapshot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_latest_snapshot: (options?: MethodOptions) => Promise<AssembledTransaction<Option<NationalSnapshot>>>

  /**
   * Construct and simulate a get_top_departments transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_top_departments: ({count}: {count: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<DepartmentBenchmark>>>

  /**
   * Construct and simulate a get_department_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_department_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_snapshot_history transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_snapshot_history: (options?: MethodOptions) => Promise<AssembledTransaction<Array<NationalSnapshot>>>

  /**
   * Construct and simulate a record_national_snapshot transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Take a snapshot of the national public value index
   */
  record_national_snapshot: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a update_department_benchmark transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit department benchmark data from value_score calculations
   */
  update_department_benchmark: ({caller, department, avg_value_score, pvo_count, total_budget, completed_projects, on_time_rate}: {caller: string, department: string, avg_value_score: u32, pvo_count: u32, total_budget: i128, completed_projects: u32, on_time_rate: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAEE5hdGlvbmFsU25hcHNob3QAAAAHAAAAAAAAAA9hdmdfdmFsdWVfc2NvcmUAAAAABAAAAAAAAAASZGVwYXJ0bWVudHNfcmFua2VkAAAAAAAEAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAAAAAAh0b3BfZGVwdAAAABAAAAAAAAAADnRvcF9kZXB0X3Njb3JlAAAAAAAEAAAAAAAAAAx0b3RhbF9idWRnZXQAAAALAAAAAAAAAAp0b3RhbF9wdm9zAAAAAAAE",
        "AAAAAAAAAAAAAAANZ2V0X2JlbmNobWFyawAAAAAAAAEAAAAAAAAACmRlcGFydG1lbnQAAAAAABAAAAABAAAD6AAAB9AAAAATRGVwYXJ0bWVudEJlbmNobWFyawA=",
        "AAAAAQAAAAAAAAAAAAAAE0RlcGFydG1lbnRCZW5jaG1hcmsAAAAABwAAAAAAAAAPYXZnX3ZhbHVlX3Njb3JlAAAAAAQAAAAAAAAAEmNvbXBsZXRlZF9wcm9qZWN0cwAAAAAABAAAAAAAAAAKZGVwYXJ0bWVudAAAAAAAEAAAAAAAAAAMb25fdGltZV9yYXRlAAAABAAAAAAAAAAJcHZvX2NvdW50AAAAAAAABAAAAAAAAAAEcmFuawAAAAQAAAAAAAAADHRvdGFsX2J1ZGdldAAAAAs=",
        "AAAABQAAAAAAAAAAAAAAFUJlbmNobWFya1VwZGF0ZWRFdmVudAAAAAAAAAEAAAAXYmVuY2htYXJrX3VwZGF0ZWRfZXZlbnQAAAAAAwAAAAAAAAAKZGVwYXJ0bWVudAAAAAAAEAAAAAAAAAAAAAAABHJhbmsAAAAEAAAAAAAAAAAAAAAPYXZnX3ZhbHVlX3Njb3JlAAAAAAQAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAFVNuYXBzaG90UmVjb3JkZWRFdmVudAAAAAAAAAEAAAAXc25hcHNob3RfcmVjb3JkZWRfZXZlbnQAAAAAAwAAAAAAAAAKdG90YWxfcHZvcwAAAAAABAAAAAAAAAAAAAAAD2F2Z192YWx1ZV9zY29yZQAAAAAEAAAAAAAAAAAAAAAIdG9wX2RlcHQAAAAQAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAASZ2V0X2FsbF9iZW5jaG1hcmtzAAAAAAAAAAAAAQAAA+oAAAfQAAAAE0RlcGFydG1lbnRCZW5jaG1hcmsA",
        "AAAAAAAAAAAAAAATZ2V0X2xhdGVzdF9zbmFwc2hvdAAAAAAAAAAAAQAAA+gAAAfQAAAAEE5hdGlvbmFsU25hcHNob3Q=",
        "AAAAAAAAAAAAAAATZ2V0X3RvcF9kZXBhcnRtZW50cwAAAAABAAAAAAAAAAVjb3VudAAAAAAAAAQAAAABAAAD6gAAB9AAAAATRGVwYXJ0bWVudEJlbmNobWFyawA=",
        "AAAAAAAAAAAAAAAUZ2V0X2RlcGFydG1lbnRfY291bnQAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAUZ2V0X3NuYXBzaG90X2hpc3RvcnkAAAAAAAAAAQAAA+oAAAfQAAAAEE5hdGlvbmFsU25hcHNob3Q=",
        "AAAAAAAAADJUYWtlIGEgc25hcHNob3Qgb2YgdGhlIG5hdGlvbmFsIHB1YmxpYyB2YWx1ZSBpbmRleAAAAAAAGHJlY29yZF9uYXRpb25hbF9zbmFwc2hvdAAAAAEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAAE",
        "AAAAAAAAAD5TdWJtaXQgZGVwYXJ0bWVudCBiZW5jaG1hcmsgZGF0YSBmcm9tIHZhbHVlX3Njb3JlIGNhbGN1bGF0aW9ucwAAAAAAG3VwZGF0ZV9kZXBhcnRtZW50X2JlbmNobWFyawAAAAAHAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAACmRlcGFydG1lbnQAAAAAABAAAAAAAAAAD2F2Z192YWx1ZV9zY29yZQAAAAAEAAAAAAAAAAlwdm9fY291bnQAAAAAAAAEAAAAAAAAAAx0b3RhbF9idWRnZXQAAAALAAAAAAAAABJjb21wbGV0ZWRfcHJvamVjdHMAAAAAAAQAAAAAAAAADG9uX3RpbWVfcmF0ZQAAAAQAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<null>,
        get_benchmark: this.txFromJSON<Option<DepartmentBenchmark>>,
        get_all_benchmarks: this.txFromJSON<Array<DepartmentBenchmark>>,
        get_latest_snapshot: this.txFromJSON<Option<NationalSnapshot>>,
        get_top_departments: this.txFromJSON<Array<DepartmentBenchmark>>,
        get_department_count: this.txFromJSON<u32>,
        get_snapshot_history: this.txFromJSON<Array<NationalSnapshot>>,
        record_national_snapshot: this.txFromJSON<u32>,
        update_department_benchmark: this.txFromJSON<null>
  }
}