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
    contractId: "CBKTM7F32KJJWVGYRCNNJQNXK5DHEISJMFESXAAJJYDSDSJYMRKJSHUW",
  }
} as const


export interface Bid {
  contractor: string;
  final_score: u32;
  id: u32;
  price: i128;
  quality_score: u32;
  reputation_score: u32;
  tender_id: u32;
  timeline_days: u32;
  timestamp: u64;
}


export interface Tender {
  agency: string;
  budget: i128;
  created_at: u64;
  deadline: u64;
  description: string;
  id: u32;
  status: TenderStatus;
  title: string;
  winner: Option<string>;
}

export type TenderStatus = {tag: "Open", values: void} | {tag: "Closed", values: void} | {tag: "Awarded", values: void} | {tag: "Cancelled", values: void};




export interface Client {
  /**
   * Construct and simulate a get_tender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_tender: ({id}: {id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Tender>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({reputation_address}: {reputation_address: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a submit_bid transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_bid: ({contractor, tender_id, price, quality_score, timeline_days}: {contractor: string, tender_id: u32, price: i128, quality_score: u32, timeline_days: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a award_tender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  award_tender: ({agency, tender_id}: {agency: string, tender_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_tender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_tender: ({agency, title, description, budget, deadline}: {agency: string, title: string, description: string, budget: i128, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_tender_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_tender_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_bids_by_tender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_bids_by_tender: ({tender_id}: {tender_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Bid>>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAAA0JpZAAAAAAJAAAAAAAAAApjb250cmFjdG9yAAAAAAATAAAAAAAAAAtmaW5hbF9zY29yZQAAAAAEAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAA1xdWFsaXR5X3Njb3JlAAAAAAAABAAAAAAAAAAQcmVwdXRhdGlvbl9zY29yZQAAAAQAAAAAAAAACXRlbmRlcl9pZAAAAAAAAAQAAAAAAAAADXRpbWVsaW5lX2RheXMAAAAAAAAEAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAAAAAAAAAAAAABlRlbmRlcgAAAAAACQAAAAAAAAAGYWdlbmN5AAAAAAATAAAAAAAAAAZidWRnZXQAAAAAAAsAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAACGRlYWRsaW5lAAAABgAAAAAAAAALZGVzY3JpcHRpb24AAAAAEAAAAAAAAAACaWQAAAAAAAQAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxUZW5kZXJTdGF0dXMAAAAAAAAABXRpdGxlAAAAAAAAEAAAAAAAAAAGd2lubmVyAAAAAAPoAAAAEw==",
        "AAAAAgAAAAAAAAAAAAAADFRlbmRlclN0YXR1cwAAAAQAAAAAAAAAAAAAAARPcGVuAAAAAAAAAAAAAAAGQ2xvc2VkAAAAAAAAAAAAAAAAAAdBd2FyZGVkAAAAAAAAAAAAAAAACUNhbmNlbGxlZAAAAA==",
        "AAAABQAAAAAAAAAAAAAAEUJpZFN1Ym1pdHRlZEV2ZW50AAAAAAAAAQAAABNiaWRfc3VibWl0dGVkX2V2ZW50AAAAAAQAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAAAAAAJdGVuZGVyX2lkAAAAAAAABAAAAAAAAAAAAAAACmNvbnRyYWN0b3IAAAAAABMAAAAAAAAAAAAAAAtmaW5hbF9zY29yZQAAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAElRlbmRlckF3YXJkZWRFdmVudAAAAAAAAQAAABR0ZW5kZXJfYXdhcmRlZF9ldmVudAAAAAMAAAAAAAAACXRlbmRlcl9pZAAAAAAAAAQAAAAAAAAAAAAAAAZ3aW5uZXIAAAAAABMAAAAAAAAAAAAAAAtmaW5hbF9zY29yZQAAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAElRlbmRlckNyZWF0ZWRFdmVudAAAAAAAAQAAABR0ZW5kZXJfY3JlYXRlZF9ldmVudAAAAAMAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAAAAAAGYWdlbmN5AAAAAAATAAAAAAAAAAAAAAAGYnVkZ2V0AAAAAAALAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAKZ2V0X3RlbmRlcgAAAAAAAQAAAAAAAAACaWQAAAAAAAQAAAABAAAD6AAAB9AAAAAGVGVuZGVyAAA=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAScmVwdXRhdGlvbl9hZGRyZXNzAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAAKc3VibWl0X2JpZAAAAAAABQAAAAAAAAAKY29udHJhY3RvcgAAAAAAEwAAAAAAAAAJdGVuZGVyX2lkAAAAAAAABAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAA1xdWFsaXR5X3Njb3JlAAAAAAAABAAAAAAAAAANdGltZWxpbmVfZGF5cwAAAAAAAAQAAAABAAAABA==",
        "AAAAAAAAAAAAAAAMYXdhcmRfdGVuZGVyAAAAAgAAAAAAAAAGYWdlbmN5AAAAAAATAAAAAAAAAAl0ZW5kZXJfaWQAAAAAAAAEAAAAAA==",
        "AAAAAAAAAAAAAAANY3JlYXRlX3RlbmRlcgAAAAAAAAUAAAAAAAAABmFnZW5jeQAAAAAAEwAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAAtkZXNjcmlwdGlvbgAAAAAQAAAAAAAAAAZidWRnZXQAAAAAAAsAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAAE",
        "AAAAAAAAAAAAAAAQZ2V0X3RlbmRlcl9jb3VudAAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAASZ2V0X2JpZHNfYnlfdGVuZGVyAAAAAAABAAAAAAAAAAl0ZW5kZXJfaWQAAAAAAAAEAAAAAQAAA+oAAAfQAAAAA0JpZAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_tender: this.txFromJSON<Option<Tender>>,
        initialize: this.txFromJSON<null>,
        submit_bid: this.txFromJSON<u32>,
        award_tender: this.txFromJSON<null>,
        create_tender: this.txFromJSON<u32>,
        get_tender_count: this.txFromJSON<u32>,
        get_bids_by_tender: this.txFromJSON<Array<Bid>>
  }
}