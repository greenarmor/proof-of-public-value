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
    contractId: "CD6KIEZBDXK7ID4JG3LM3RG44XAEVBXR6TS6TXCRQ2EQA36WHW3GMXT4",
  }
} as const


export interface Evidence {
  data_hash: string;
  evidence_type: EvidenceType;
  id: u32;
  metadata: string;
  submitted_at: u64;
  submitter: string;
  verified: boolean;
}


export interface Milestone {
  ai_validated: boolean;
  budget: i128;
  community_confirmations: u32;
  community_required: u32;
  compliance_passed: boolean;
  description: string;
  engineer_approved: boolean;
  id: u32;
  required_evidence: Array<EvidenceType>;
  status: MilestoneStatus;
  submitted_evidence: Array<Evidence>;
  title: string;
}

export type PVOStatus = {tag: "Proposed", values: void} | {tag: "Approved", values: void} | {tag: "InProgress", values: void} | {tag: "UnderReview", values: void} | {tag: "Completed", values: void} | {tag: "Suspended", values: void} | {tag: "Terminated", values: void};

export type EvidenceType = {tag: "DroneImagery", values: void} | {tag: "SatelliteImagery", values: void} | {tag: "GpsCoordinates", values: void} | {tag: "TimestampedPhoto", values: void} | {tag: "TimestampedVideo", values: void} | {tag: "IoTSensor", values: void} | {tag: "EngineeringReport", values: void} | {tag: "LabResult", values: void} | {tag: "InspectionReport", values: void} | {tag: "CommunityVerification", values: void};

export type MilestoneStatus = {tag: "Pending", values: void} | {tag: "EvidenceSubmitted", values: void} | {tag: "EngineerApproved", values: void} | {tag: "AIValidated", values: void} | {tag: "CommunityVerified", values: void} | {tag: "CompliancePassed", values: void} | {tag: "Released", values: void} | {tag: "Rejected", values: void};



export interface PublicValueObject {
  contractor: string;
  created_at: u64;
  deadline: u64;
  department: string;
  description: string;
  fund_source: string;
  funding_agency: string;
  id: u32;
  milestones: Array<u32>;
  municipality: string;
  project_manager: string;
  public_value_score: u32;
  status: PVOStatus;
  title: string;
  total_budget: i128;
  updated_at: u64;
}






export interface Client {
  /**
   * Construct and simulate a get_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pvo: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PublicValueObject>>>

  /**
   * Construct and simulate a create_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_pvo: ({creator, title, description, funding_agency, contractor, project_manager, department, municipality, total_budget, fund_source, deadline}: {creator: string, title: string, description: string, funding_agency: string, contractor: string, project_manager: string, department: string, municipality: string, total_budget: i128, fund_source: string, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a ai_validate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  ai_validate: ({auditor, milestone_id, passed}: {auditor: string, milestone_id: u32, passed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_milestone: ({milestone_id}: {milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Milestone>>>

  /**
   * Construct and simulate a get_pvo_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pvo_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a submit_evidence transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_evidence: ({submitter, pvo_id, milestone_id, evidence_type, data_hash, metadata}: {submitter: string, pvo_id: u32, milestone_id: u32, evidence_type: EvidenceType, data_hash: string, metadata: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a compliance_check transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  compliance_check: ({officer, milestone_id, passed}: {officer: string, milestone_id: u32, passed: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_milestone: ({creator, pvo_id, title, description, budget, required_evidence, community_required}: {creator: string, pvo_id: u32, title: string, description: string, budget: i128, required_evidence: Array<EvidenceType>, community_required: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a engineer_approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  engineer_approve: ({engineer, milestone_id}: {engineer: string, milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a release_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release_milestone: ({caller, milestone_id}: {caller: string, milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a update_pvo_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_pvo_status: ({updater, pvo_id, new_status}: {updater: string, pvo_id: u32, new_status: PVOStatus}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_pvo_milestones transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pvo_milestones: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Milestone>>>

  /**
   * Construct and simulate a update_value_score transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_value_score: ({updater, pvo_id, score}: {updater: string, pvo_id: u32, score: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a check_milestone_ready transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  check_milestone_ready: ({milestone_id}: {milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_pv_os_by_contractor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pv_os_by_contractor: ({contractor}: {contractor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<PublicValueObject>>>

  /**
   * Construct and simulate a add_community_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_community_verification: ({citizen, milestone_id}: {citizen: string, milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
      new ContractSpec([ "AAAAAAAAAAAAAAAHZ2V0X3B2bwAAAAABAAAAAAAAAAZwdm9faWQAAAAAAAQAAAABAAAD6AAAB9AAAAARUHVibGljVmFsdWVPYmplY3QAAAA=",
        "AAAAAQAAAAAAAAAAAAAACEV2aWRlbmNlAAAABwAAAAAAAAAJZGF0YV9oYXNoAAAAAAAAEAAAAAAAAAANZXZpZGVuY2VfdHlwZQAAAAAAB9AAAAAMRXZpZGVuY2VUeXBlAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAIbWV0YWRhdGEAAAAQAAAAAAAAAAxzdWJtaXR0ZWRfYXQAAAAGAAAAAAAAAAlzdWJtaXR0ZXIAAAAAAAATAAAAAAAAAAh2ZXJpZmllZAAAAAE=",
        "AAAAAQAAAAAAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAwAAAAAAAAADGFpX3ZhbGlkYXRlZAAAAAEAAAAAAAAABmJ1ZGdldAAAAAAACwAAAAAAAAAXY29tbXVuaXR5X2NvbmZpcm1hdGlvbnMAAAAABAAAAAAAAAASY29tbXVuaXR5X3JlcXVpcmVkAAAAAAAEAAAAAAAAABFjb21wbGlhbmNlX3Bhc3NlZAAAAAAAAAEAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAAEWVuZ2luZWVyX2FwcHJvdmVkAAAAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAAAAAAAEXJlcXVpcmVkX2V2aWRlbmNlAAAAAAAD6gAAB9AAAAAMRXZpZGVuY2VUeXBlAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAPTWlsZXN0b25lU3RhdHVzAAAAAAAAAAASc3VibWl0dGVkX2V2aWRlbmNlAAAAAAPqAAAH0AAAAAhFdmlkZW5jZQAAAAAAAAAFdGl0bGUAAAAAAAAQ",
        "AAAAAgAAAAAAAAAAAAAACVBWT1N0YXR1cwAAAAAAAAcAAAAAAAAAAAAAAAhQcm9wb3NlZAAAAAAAAAAAAAAACEFwcHJvdmVkAAAAAAAAAAAAAAAKSW5Qcm9ncmVzcwAAAAAAAAAAAAAAAAALVW5kZXJSZXZpZXcAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJU3VzcGVuZGVkAAAAAAAAAAAAAAAAAAAKVGVybWluYXRlZAAA",
        "AAAAAAAAAAAAAAAKY3JlYXRlX3B2bwAAAAAACwAAAAAAAAAHY3JlYXRvcgAAAAATAAAAAAAAAAV0aXRsZQAAAAAAABAAAAAAAAAAC2Rlc2NyaXB0aW9uAAAAABAAAAAAAAAADmZ1bmRpbmdfYWdlbmN5AAAAAAATAAAAAAAAAApjb250cmFjdG9yAAAAAAATAAAAAAAAAA9wcm9qZWN0X21hbmFnZXIAAAAAEwAAAAAAAAAKZGVwYXJ0bWVudAAAAAAAEAAAAAAAAAAMbXVuaWNpcGFsaXR5AAAAEAAAAAAAAAAMdG90YWxfYnVkZ2V0AAAACwAAAAAAAAALZnVuZF9zb3VyY2UAAAAAEAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAAAAAAA=",
        "AAAAAAAAAAAAAAALYWlfdmFsaWRhdGUAAAAAAwAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAAAAAAZwYXNzZWQAAAAAAAEAAAAA",
        "AAAAAgAAAAAAAAAAAAAADEV2aWRlbmNlVHlwZQAAAAoAAAAAAAAAAAAAAAxEcm9uZUltYWdlcnkAAAAAAAAAAAAAABBTYXRlbGxpdGVJbWFnZXJ5AAAAAAAAAAAAAAAOR3BzQ29vcmRpbmF0ZXMAAAAAAAAAAAAAAAAAEFRpbWVzdGFtcGVkUGhvdG8AAAAAAAAAAAAAABBUaW1lc3RhbXBlZFZpZGVvAAAAAAAAAAAAAAAJSW9UU2Vuc29yAAAAAAAAAAAAAAAAAAARRW5naW5lZXJpbmdSZXBvcnQAAAAAAAAAAAAAAAAAAAlMYWJSZXN1bHQAAAAAAAAAAAAAAAAAABBJbnNwZWN0aW9uUmVwb3J0AAAAAAAAAAAAAAAVQ29tbXVuaXR5VmVyaWZpY2F0aW9uAAAA",
        "AAAAAAAAAAAAAAANZ2V0X21pbGVzdG9uZQAAAAAAAAEAAAAAAAAADG1pbGVzdG9uZV9pZAAAAAQAAAABAAAD6AAAB9AAAAAJTWlsZXN0b25lAAAA",
        "AAAAAAAAAAAAAAANZ2V0X3B2b19jb3VudAAAAAAAAAAAAAABAAAABA==",
        "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",
        "AAAAAAAAAAAAAAAVY2hlY2tfbWlsZXN0b25lX3JlYWR5AAAAAAAAAQAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAEAAAAB",
        "AAAABQAAAAAAAAAAAAAAFU1pbGVzdG9uZUNyZWF0ZWRFdmVudAAAAAAAAAEAAAAXbWlsZXN0b25lX2NyZWF0ZWRfZXZlbnQAAAAAAwAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAAAAAAAAAAABmJ1ZGdldAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFVBWT1N0YXR1c0NoYW5nZWRFdmVudAAAAAAAAAEAAAAYcHZvX3N0YXR1c19jaGFuZ2VkX2V2ZW50AAAAAwAAAAAAAAACaWQAAAAAAAQAAAAAAAAAAAAAAApvbGRfc3RhdHVzAAAAAAfQAAAACVBWT1N0YXR1cwAAAAAAAAAAAAAAAAAACm5ld19zdGF0dXMAAAAAB9AAAAAJUFZPU3RhdHVzAAAAAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFkV2aWRlbmNlU3VibWl0dGVkRXZlbnQAAAAAAAEAAAAYZXZpZGVuY2Vfc3VibWl0dGVkX2V2ZW50AAAABAAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAAAAAAAAAAAC2V2aWRlbmNlX2lkAAAAAAQAAAAAAAAAAAAAAA1ldmlkZW5jZV90eXBlAAAAAAAH0AAAAAxFdmlkZW5jZVR5cGUAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAFlZhbHVlU2NvcmVVcGRhdGVkRXZlbnQAAAAAAAEAAAAZdmFsdWVfc2NvcmVfdXBkYXRlZF9ldmVudAAAAAAAAAIAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAC",
        "AAAAAAAAAAAAAAAXZ2V0X3B2X29zX2J5X2NvbnRyYWN0b3IAAAAAAQAAAAAAAAAKY29udHJhY3RvcgAAAAAAEwAAAAEAAAPqAAAH0AAAABFQdWJsaWNWYWx1ZU9iamVjdAAAAA==",
        "AAAAAAAAAAAAAAAaYWRkX2NvbW11bml0eV92ZXJpZmljYXRpb24AAAAAAAIAAAAAAAAAB2NpdGl6ZW4AAAAAEwAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAA=",
        "AAAABQAAAAAAAAAAAAAAG01pbGVzdG9uZVN0YXR1c0NoYW5nZWRFdmVudAAAAAABAAAAHm1pbGVzdG9uZV9zdGF0dXNfY2hhbmdlZF9ldmVudAAAAAAAAwAAAAAAAAAGcHZvX2lkAAAAAAAEAAAAAAAAAAAAAAAMbWlsZXN0b25lX2lkAAAABAAAAAAAAAAAAAAACm5ld19zdGF0dXMAAAAAB9AAAAAPTWlsZXN0b25lU3RhdHVzAAAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_pvo: this.txFromJSON<Option<PublicValueObject>>,
        create_pvo: this.txFromJSON<u32>,
        initialize: this.txFromJSON<null>,
        ai_validate: this.txFromJSON<null>,
        get_milestone: this.txFromJSON<Option<Milestone>>,
        get_pvo_count: this.txFromJSON<u32>,
        submit_evidence: this.txFromJSON<u32>,
        compliance_check: this.txFromJSON<null>,
        create_milestone: this.txFromJSON<u32>,
        engineer_approve: this.txFromJSON<null>,
        release_milestone: this.txFromJSON<boolean>,
        update_pvo_status: this.txFromJSON<null>,
        get_pvo_milestones: this.txFromJSON<Array<Milestone>>,
        update_value_score: this.txFromJSON<null>,
        check_milestone_ready: this.txFromJSON<boolean>,
        get_pv_os_by_contractor: this.txFromJSON<Array<PublicValueObject>>,
        add_community_verification: this.txFromJSON<null>
  }
}