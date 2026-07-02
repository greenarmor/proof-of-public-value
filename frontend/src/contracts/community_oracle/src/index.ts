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
    contractId: "CCTM2WTQ7V7KSTXWJRBAJAROC25STQPW2UGAJQBECKAL5UGM23QEEIOV",
  }
} as const

export type ReportType = {tag: "GpsPhoto", values: void} | {tag: "GpsVideo", values: void} | {tag: "FloodReport", values: void} | {tag: "CompletionVerification", values: void} | {tag: "QualityReport", values: void} | {tag: "DamageReport", values: void} | {tag: "UsageReport", values: void};


export interface CommunityReport {
  citizen: string;
  confidence_score: u32;
  data_hash: string;
  gps_lat: i128;
  gps_lon: i128;
  id: u32;
  milestone_id: u32;
  pvo_id: u32;
  report_type: ReportType;
  timestamp: u64;
  verified: boolean;
}


export interface CitizenReputation {
  address: string;
  confidence_rating: u32;
  total_reports: u32;
  verified_reports: u32;
}




export interface Client {
  /**
   * Construct and simulate a get_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_report: ({report_id}: {report_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CommunityReport>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a submit_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_report: ({citizen, pvo_id, milestone_id, report_type, data_hash, gps_lat, gps_lon}: {citizen: string, pvo_id: u32, milestone_id: u32, report_type: ReportType, data_hash: string, gps_lat: i128, gps_lon: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a verify_report transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  verify_report: ({verifier, report_id, verifier_weight}: {verifier: string, report_id: u32, verifier_weight: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_report_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_report_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_reports_by_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reports_by_pvo: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<CommunityReport>>>

  /**
   * Construct and simulate a calculate_confidence transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  calculate_confidence: ({caller, pvo_id, milestone_id}: {caller: string, pvo_id: u32, milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_citizen_reputation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_citizen_reputation: ({citizen}: {citizen: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<CitizenReputation>>>

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
      new ContractSpec([ "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" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_report: this.txFromJSON<Option<CommunityReport>>,
        initialize: this.txFromJSON<null>,
        submit_report: this.txFromJSON<u32>,
        verify_report: this.txFromJSON<null>,
        get_report_count: this.txFromJSON<u32>,
        get_reports_by_pvo: this.txFromJSON<Array<CommunityReport>>,
        calculate_confidence: this.txFromJSON<u32>,
        get_citizen_reputation: this.txFromJSON<Option<CitizenReputation>>
  }
}