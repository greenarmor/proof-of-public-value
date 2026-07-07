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
    contractId: "CD5ZAPMO7VCCJICL5BMRXADEOH435RDVKIHHFOXOLTOGF3OCXOJKE7FQ",
  }
} as const

export type ComplianceRule = {tag: "ProcurementLaw", values: void} | {tag: "COAregulation", values: void} | {tag: "EnvironmentalRegulation", values: void} | {tag: "BudgetDeviation", values: void} | {tag: "SafetyViolation", values: void} | {tag: "LaborCompliance", values: void};


export interface ViolationRecord {
  auto_paused: boolean;
  description: string;
  id: u32;
  pvo_id: u32;
  reporter: string;
  resolved: boolean;
  rule: ComplianceRule;
  severity: u32;
  timestamp: u64;
}



export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_violation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_violation: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ViolationRecord>>>

  /**
   * Construct and simulate a is_pvo_compliant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_pvo_compliant: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a report_violation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Report a compliance violation — auto-pauses if severity ≥ 70
   */
  report_violation: ({officer, pvo_id, rule, description, severity}: {officer: string, pvo_id: u32, rule: ComplianceRule, description: string, severity: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a resolve_violation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mark a violation as resolved
   */
  resolve_violation: ({officer, violation_id}: {officer: string, violation_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_violation_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_violation_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_active_violations transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_active_violations: (options?: MethodOptions) => Promise<AssembledTransaction<Array<ViolationRecord>>>

  /**
   * Construct and simulate a get_violations_by_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_violations_by_pvo: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<ViolationRecord>>>

  /**
   * Construct and simulate a add_compliance_officer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_compliance_officer: ({admin, officer}: {admin: string, officer: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAADkNvbXBsaWFuY2VSdWxlAAAAAAAGAAAAAAAAAAAAAAAOUHJvY3VyZW1lbnRMYXcAAAAAAAAAAAAAAAAADUNPQXJlZ3VsYXRpb24AAAAAAAAAAAAAAAAAABdFbnZpcm9ubWVudGFsUmVndWxhdGlvbgAAAAAAAAAAAAAAAA9CdWRnZXREZXZpYXRpb24AAAAAAAAAAAAAAAAPU2FmZXR5VmlvbGF0aW9uAAAAAAAAAAAAAAAAD0xhYm9yQ29tcGxpYW5jZQA=",
        "AAAAAQAAAAAAAAAAAAAAD1Zpb2xhdGlvblJlY29yZAAAAAAJAAAAAAAAAAthdXRvX3BhdXNlZAAAAAABAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAhyZXBvcnRlcgAAABMAAAAAAAAACHJlc29sdmVkAAAAAQAAAAAAAAAEcnVsZQAAB9AAAAAOQ29tcGxpYW5jZVJ1bGUAAAAAAAAAAAAIc2V2ZXJpdHkAAAAEAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAANZ2V0X3Zpb2xhdGlvbgAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAQAAA+gAAAfQAAAAD1Zpb2xhdGlvblJlY29yZAA=",
        "AAAABQAAAAAAAAAAAAAAFlZpb2xhdGlvbkRldGVjdGVkRXZlbnQAAAAAAAEAAAAYdmlvbGF0aW9uX2RldGVjdGVkX2V2ZW50AAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAAAAAAAAhzZXZlcml0eQAAAAQAAAAAAAAAAAAAAAthdXRvX3BhdXNlZAAAAAABAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFlZpb2xhdGlvblJlc29sdmVkRXZlbnQAAAAAAAEAAAAYdmlvbGF0aW9uX3Jlc29sdmVkX2V2ZW50AAAAAgAAAAAAAAACaWQAAAAAAAQAAAAAAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAAQaXNfcHZvX2NvbXBsaWFudAAAAAEAAAAAAAAABnB2b19pZAAAAAAABAAAAAEAAAAB",
        "AAAAAAAAAEBSZXBvcnQgYSBjb21wbGlhbmNlIHZpb2xhdGlvbiDigJQgYXV0by1wYXVzZXMgaWYgc2V2ZXJpdHkg4omlIDcwAAAAEHJlcG9ydF92aW9sYXRpb24AAAAFAAAAAAAAAAdvZmZpY2VyAAAAABMAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAEcnVsZQAAB9AAAAAOQ29tcGxpYW5jZVJ1bGUAAAAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAAIc2V2ZXJpdHkAAAAEAAAAAQAAAAQ=",
        "AAAAAAAAABxNYXJrIGEgdmlvbGF0aW9uIGFzIHJlc29sdmVkAAAAEXJlc29sdmVfdmlvbGF0aW9uAAAAAAAAAgAAAAAAAAAHb2ZmaWNlcgAAAAATAAAAAAAAAAx2aW9sYXRpb25faWQAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAATZ2V0X3Zpb2xhdGlvbl9jb3VudAAAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAVZ2V0X2FjdGl2ZV92aW9sYXRpb25zAAAAAAAAAAAAAAEAAAPqAAAH0AAAAA9WaW9sYXRpb25SZWNvcmQA",
        "AAAAAAAAAAAAAAAVZ2V0X3Zpb2xhdGlvbnNfYnlfcHZvAAAAAAAAAQAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAQAAA+oAAAfQAAAAD1Zpb2xhdGlvblJlY29yZAA=",
        "AAAAAAAAAAAAAAAWYWRkX2NvbXBsaWFuY2Vfb2ZmaWNlcgAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAdvZmZpY2VyAAAAABMAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<null>,
        get_violation: this.txFromJSON<Option<ViolationRecord>>,
        is_pvo_compliant: this.txFromJSON<boolean>,
        report_violation: this.txFromJSON<u32>,
        resolve_violation: this.txFromJSON<null>,
        get_violation_count: this.txFromJSON<u32>,
        get_active_violations: this.txFromJSON<Array<ViolationRecord>>,
        get_violations_by_pvo: this.txFromJSON<Array<ViolationRecord>>,
        add_compliance_officer: this.txFromJSON<null>
  }
}