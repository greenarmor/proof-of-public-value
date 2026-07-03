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
    contractId: "CCJKTSLT5JX4VNMHIHLYVFOBIRWIIYUUTNTYC7R35AFAWAIEQITDRXPX",
  }
} as const


export interface DigitalTwin {
  deviation_alert: boolean;
  expected_cost: i128;
  labor_cost_index: u32;
  last_updated: u64;
  material_cost_index: u32;
  pvo_id: u32;
}

export type FraudIndicator = {tag: "DuplicateInvoice", values: void} | {tag: "GhostProject", values: void} | {tag: "AbnormalBudgetGrowth", values: void} | {tag: "UnusualPaymentTiming", values: void} | {tag: "CollusionPattern", values: void} | {tag: "RepeatedContractorWin", values: void} | {tag: "MaterialCostInflation", values: void} | {tag: "ShellCompanyRisk", values: void};


export interface RiskPrediction {
  auditor: string;
  confidence: u32;
  contractor: string;
  delay_probability: u32;
  id: u32;
  overrun_probability: u32;
  risk_category: u32;
  timestamp: u64;
}


export interface ImageVerification {
  auditor: string;
  authenticity_score: u32;
  evidence_id: u32;
  id: u32;
  progress_percent: u32;
  summary: string;
  timestamp: u64;
}





export interface FraudDetectionResult {
  auditor: string;
  confidence: u32;
  evidence_hash: string;
  id: u32;
  indicators: Array<FraudIndicator>;
  pvo_id: u32;
  risk_score: u32;
  timestamp: u64;
}


export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a add_ai_auditor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_ai_auditor: ({admin, auditor}: {admin: string, auditor: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_fraud_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_fraud_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_digital_twin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_digital_twin: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<DigitalTwin>>>

  /**
   * Construct and simulate a get_fraud_by_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_fraud_by_pvo: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<FraudDetectionResult>>>

  /**
   * Construct and simulate a remove_ai_auditor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  remove_ai_auditor: ({admin, auditor}: {admin: string, auditor: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_fraud_detection transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_fraud_detection: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<FraudDetectionResult>>>

  /**
   * Construct and simulate a update_digital_twin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update digital twin (procurement cost simulation)
   */
  update_digital_twin: ({auditor, pvo_id, expected_cost, material_cost_index, labor_cost_index, deviation_alert}: {auditor: string, pvo_id: u32, expected_cost: i128, material_cost_index: u32, labor_cost_index: u32, deviation_alert: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_image_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_image_verification: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ImageVerification>>>

  /**
   * Construct and simulate a submit_fraud_detection transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a fraud detection result (AI auditor only)
   */
  submit_fraud_detection: ({auditor, pvo_id, risk_score, indicators, confidence, evidence_hash}: {auditor: string, pvo_id: u32, risk_score: u32, indicators: Array<FraudIndicator>, confidence: u32, evidence_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a submit_risk_prediction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit a risk prediction (AI auditor only)
   */
  submit_risk_prediction: ({auditor, contractor, delay_probability, overrun_probability, risk_category, confidence}: {auditor: string, contractor: string, delay_probability: u32, overrun_probability: u32, risk_category: u32, confidence: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a submit_image_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Submit image/satellite verification result (AI auditor only)
   */
  submit_image_verification: ({auditor, evidence_id, progress_percent, authenticity_score, summary}: {auditor: string, evidence_id: u32, progress_percent: u32, authenticity_score: u32, summary: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_latest_risk_prediction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_latest_risk_prediction: ({contractor}: {contractor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<RiskPrediction>>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAAC0RpZ2l0YWxUd2luAAAAAAYAAAAAAAAAD2RldmlhdGlvbl9hbGVydAAAAAABAAAAAAAAAA1leHBlY3RlZF9jb3N0AAAAAAAACwAAAAAAAAAQbGFib3JfY29zdF9pbmRleAAAAAQAAAAAAAAADGxhc3RfdXBkYXRlZAAAAAYAAAAAAAAAE21hdGVyaWFsX2Nvc3RfaW5kZXgAAAAABAAAAAAAAAAGcHZvX2lkAAAAAAAE",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAAAgAAAAAAAAAAAAAADkZyYXVkSW5kaWNhdG9yAAAAAAAIAAAAAAAAAAAAAAAQRHVwbGljYXRlSW52b2ljZQAAAAAAAAAAAAAADEdob3N0UHJvamVjdAAAAAAAAAAAAAAAFEFibm9ybWFsQnVkZ2V0R3Jvd3RoAAAAAAAAAAAAAAAUVW51c3VhbFBheW1lbnRUaW1pbmcAAAAAAAAAAAAAABBDb2xsdXNpb25QYXR0ZXJuAAAAAAAAAAAAAAAVUmVwZWF0ZWRDb250cmFjdG9yV2luAAAAAAAAAAAAAAAAAAAVTWF0ZXJpYWxDb3N0SW5mbGF0aW9uAAAAAAAAAAAAAAAAAAAQU2hlbGxDb21wYW55Umlzaw==",
        "AAAAAQAAAAAAAAAAAAAADlJpc2tQcmVkaWN0aW9uAAAAAAAIAAAAAAAAAAdhdWRpdG9yAAAAABMAAAAAAAAACmNvbmZpZGVuY2UAAAAAAAQAAAAAAAAACmNvbnRyYWN0b3IAAAAAABMAAAAAAAAAEWRlbGF5X3Byb2JhYmlsaXR5AAAAAAAABAAAAAAAAAACaWQAAAAAAAQAAAAAAAAAE292ZXJydW5fcHJvYmFiaWxpdHkAAAAABAAAAAAAAAANcmlza19jYXRlZ29yeQAAAAAAAAQAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAY=",
        "AAAAAAAAAAAAAAAOYWRkX2FpX2F1ZGl0b3IAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAPZ2V0X2ZyYXVkX2NvdW50AAAAAAAAAAABAAAABA==",
        "AAAAAQAAAAAAAAAAAAAAEUltYWdlVmVyaWZpY2F0aW9uAAAAAAAABwAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAAAAABJhdXRoZW50aWNpdHlfc2NvcmUAAAAAAAQAAAAAAAAAC2V2aWRlbmNlX2lkAAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAABBwcm9ncmVzc19wZXJjZW50AAAABAAAAAAAAAAHc3VtbWFyeQAAAAAQAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAAAAAAAAAAAQZ2V0X2RpZ2l0YWxfdHdpbgAAAAEAAAAAAAAABnB2b19pZAAAAAAABAAAAAEAAAPoAAAH0AAAAAtEaWdpdGFsVHdpbgA=",
        "AAAAAAAAAAAAAAAQZ2V0X2ZyYXVkX2J5X3B2bwAAAAEAAAAAAAAABnB2b19pZAAAAAAABAAAAAEAAAPqAAAH0AAAABRGcmF1ZERldGVjdGlvblJlc3VsdA==",
        "AAAAAAAAAAAAAAARcmVtb3ZlX2FpX2F1ZGl0b3IAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAB2F1ZGl0b3IAAAAAEwAAAAA=",
        "AAAABQAAAAAAAAAAAAAAEkZyYXVkRGV0ZWN0ZWRFdmVudAAAAAAAAQAAABRmcmF1ZF9kZXRlY3RlZF9ldmVudAAAAAMAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAAAAAACnJpc2tfc2NvcmUAAAAAAAQAAAAAAAAAAAAAAAdhdWRpdG9yAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAEkltYWdlVmVyaWZpZWRFdmVudAAAAAAAAQAAABRpbWFnZV92ZXJpZmllZF9ldmVudAAAAAIAAAAAAAAAC2V2aWRlbmNlX2lkAAAAAAQAAAAAAAAAAAAAABBwcm9ncmVzc19wZXJjZW50AAAABAAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAElJpc2tQcmVkaWN0ZWRFdmVudAAAAAAAAQAAABRyaXNrX3ByZWRpY3RlZF9ldmVudAAAAAIAAAAAAAAACmNvbnRyYWN0b3IAAAAAABMAAAAAAAAAAAAAAA1yaXNrX2NhdGVnb3J5AAAAAAAABAAAAAAAAAAC",
        "AAAAAQAAAAAAAAAAAAAAFEZyYXVkRGV0ZWN0aW9uUmVzdWx0AAAACAAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAAAAAApjb25maWRlbmNlAAAAAAAEAAAAAAAAAA1ldmlkZW5jZV9oYXNoAAAAAAAAEAAAAAAAAAACaWQAAAAAAAQAAAAAAAAACmluZGljYXRvcnMAAAAAA+oAAAfQAAAADkZyYXVkSW5kaWNhdG9yAAAAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAKcmlza19zY29yZQAAAAAABAAAAAAAAAAJdGltZXN0YW1wAAAAAAAABg==",
        "AAAAAAAAAAAAAAATZ2V0X2ZyYXVkX2RldGVjdGlvbgAAAAABAAAAAAAAAAJpZAAAAAAABAAAAAEAAAPoAAAH0AAAABRGcmF1ZERldGVjdGlvblJlc3VsdA==",
        "AAAAAAAAADFVcGRhdGUgZGlnaXRhbCB0d2luIChwcm9jdXJlbWVudCBjb3N0IHNpbXVsYXRpb24pAAAAAAAAE3VwZGF0ZV9kaWdpdGFsX3R3aW4AAAAABgAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAADWV4cGVjdGVkX2Nvc3QAAAAAAAALAAAAAAAAABNtYXRlcmlhbF9jb3N0X2luZGV4AAAAAAQAAAAAAAAAEGxhYm9yX2Nvc3RfaW5kZXgAAAAEAAAAAAAAAA9kZXZpYXRpb25fYWxlcnQAAAAAAQAAAAA=",
        "AAAAAAAAAAAAAAAWZ2V0X2ltYWdlX3ZlcmlmaWNhdGlvbgAAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAD6AAAB9AAAAARSW1hZ2VWZXJpZmljYXRpb24AAAA=",
        "AAAAAAAAADFTdWJtaXQgYSBmcmF1ZCBkZXRlY3Rpb24gcmVzdWx0IChBSSBhdWRpdG9yIG9ubHkpAAAAAAAAFnN1Ym1pdF9mcmF1ZF9kZXRlY3Rpb24AAAAAAAYAAAAAAAAAB2F1ZGl0b3IAAAAAEwAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAApyaXNrX3Njb3JlAAAAAAAEAAAAAAAAAAppbmRpY2F0b3JzAAAAAAPqAAAH0AAAAA5GcmF1ZEluZGljYXRvcgAAAAAAAAAAAApjb25maWRlbmNlAAAAAAAEAAAAAAAAAA1ldmlkZW5jZV9oYXNoAAAAAAAAEAAAAAEAAAAE",
        "AAAAAAAAACpTdWJtaXQgYSByaXNrIHByZWRpY3Rpb24gKEFJIGF1ZGl0b3Igb25seSkAAAAAABZzdWJtaXRfcmlza19wcmVkaWN0aW9uAAAAAAAGAAAAAAAAAAdhdWRpdG9yAAAAABMAAAAAAAAACmNvbnRyYWN0b3IAAAAAABMAAAAAAAAAEWRlbGF5X3Byb2JhYmlsaXR5AAAAAAAABAAAAAAAAAATb3ZlcnJ1bl9wcm9iYWJpbGl0eQAAAAAEAAAAAAAAAA1yaXNrX2NhdGVnb3J5AAAAAAAABAAAAAAAAAAKY29uZmlkZW5jZQAAAAAABAAAAAEAAAAE",
        "AAAABQAAAAAAAAAAAAAAF0RpZ2l0YWxUd2luVXBkYXRlZEV2ZW50AAAAAAEAAAAaZGlnaXRhbF90d2luX3VwZGF0ZWRfZXZlbnQAAAAAAAMAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAAAAAADWV4cGVjdGVkX2Nvc3QAAAAAAAALAAAAAAAAAAAAAAAPZGV2aWF0aW9uX2FsZXJ0AAAAAAEAAAAAAAAAAg==",
        "AAAAAAAAADxTdWJtaXQgaW1hZ2Uvc2F0ZWxsaXRlIHZlcmlmaWNhdGlvbiByZXN1bHQgKEFJIGF1ZGl0b3Igb25seSkAAAAZc3VibWl0X2ltYWdlX3ZlcmlmaWNhdGlvbgAAAAAAAAUAAAAAAAAAB2F1ZGl0b3IAAAAAEwAAAAAAAAALZXZpZGVuY2VfaWQAAAAABAAAAAAAAAAQcHJvZ3Jlc3NfcGVyY2VudAAAAAQAAAAAAAAAEmF1dGhlbnRpY2l0eV9zY29yZQAAAAAABAAAAAAAAAAHc3VtbWFyeQAAAAAQAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAaZ2V0X2xhdGVzdF9yaXNrX3ByZWRpY3Rpb24AAAAAAAEAAAAAAAAACmNvbnRyYWN0b3IAAAAAABMAAAABAAAD6AAAB9AAAAAOUmlza1ByZWRpY3Rpb24AAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<null>,
        add_ai_auditor: this.txFromJSON<null>,
        get_fraud_count: this.txFromJSON<u32>,
        get_digital_twin: this.txFromJSON<Option<DigitalTwin>>,
        get_fraud_by_pvo: this.txFromJSON<Array<FraudDetectionResult>>,
        remove_ai_auditor: this.txFromJSON<null>,
        get_fraud_detection: this.txFromJSON<Option<FraudDetectionResult>>,
        update_digital_twin: this.txFromJSON<null>,
        get_image_verification: this.txFromJSON<Option<ImageVerification>>,
        submit_fraud_detection: this.txFromJSON<u32>,
        submit_risk_prediction: this.txFromJSON<u32>,
        submit_image_verification: this.txFromJSON<u32>,
        get_latest_risk_prediction: this.txFromJSON<Option<RiskPrediction>>
  }
}