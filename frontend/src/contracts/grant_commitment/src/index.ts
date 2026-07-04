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
    contractId: "CCBXEOHTCHQDO57I5UA7XJKLHBGOUEPUNE6I4AEJ4GSHO6QDA2GIFOZM",
  }
} as const


export interface Grant {
  amount: i128;
  created_at: u64;
  donor: string;
  id: u32;
  org_name: string;
  pvo_id: u32;
  status: GrantStatus;
  updated_at: u64;
}

export type GrantStatus = {tag: "Committed", values: void} | {tag: "Disbursed", values: void} | {tag: "Completed", values: void} | {tag: "Cancelled", values: void};



export interface Client {
  /**
   * Construct and simulate a get_grant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_grant: ({grant_id}: {grant_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Grant>>>

  /**
   * Construct and simulate a commit_grant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  commit_grant: ({donor, pvo_id, amount, org_name}: {donor: string, pvo_id: u32, amount: i128, org_name: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a update_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_status: ({donor, grant_id, new_status}: {donor: string, grant_id: u32, new_status: GrantStatus}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_all_grants transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_all_grants: (options?: MethodOptions) => Promise<AssembledTransaction<Array<Grant>>>

  /**
   * Construct and simulate a get_grant_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_grant_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a get_grants_by_pvo transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_grants_by_pvo: ({pvo_id}: {pvo_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Grant>>>

  /**
   * Construct and simulate a get_grants_by_donor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_grants_by_donor: ({donor}: {donor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Grant>>>

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
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABUdyYW50AAAAAAAACAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAApjcmVhdGVkX2F0AAAAAAAGAAAAAAAAAAVkb25vcgAAAAAAABMAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAhvcmdfbmFtZQAAABAAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAC0dyYW50U3RhdHVzAAAAAAAAAAAKdXBkYXRlZF9hdAAAAAAABg==",
        "AAAAAgAAAAAAAAAAAAAAC0dyYW50U3RhdHVzAAAAAAQAAAAAAAAAAAAAAAlDb21taXR0ZWQAAAAAAAAAAAAAAAAAAAlEaXNidXJzZWQAAAAAAAAAAAAAAAAAAAlDb21wbGV0ZWQAAAAAAAAAAAAAAAAAAAlDYW5jZWxsZWQAAAA=",
        "AAAAAAAAAAAAAAAJZ2V0X2dyYW50AAAAAAAAAQAAAAAAAAAIZ3JhbnRfaWQAAAAEAAAAAQAAA+gAAAfQAAAABUdyYW50AAAA",
        "AAAABQAAAAAAAAAAAAAAE0dyYW50Q29tbWl0dGVkRXZlbnQAAAAAAQAAABVncmFudF9jb21taXR0ZWRfZXZlbnQAAAAAAAAFAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAAAAAABnB2b19pZAAAAAAABAAAAAAAAAAAAAAABWRvbm9yAAAAAAAAEwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACG9yZ19uYW1lAAAAEAAAAAAAAAAC",
        "AAAAAAAAAAAAAAAMY29tbWl0X2dyYW50AAAABAAAAAAAAAAFZG9ub3IAAAAAAAATAAAAAAAAAAZwdm9faWQAAAAAAAQAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIb3JnX25hbWUAAAAQAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAANdXBkYXRlX3N0YXR1cwAAAAAAAAMAAAAAAAAABWRvbm9yAAAAAAAAEwAAAAAAAAAIZ3JhbnRfaWQAAAAEAAAAAAAAAApuZXdfc3RhdHVzAAAAAAfQAAAAC0dyYW50U3RhdHVzAAAAAAA=",
        "AAAAAAAAAAAAAAAOZ2V0X2FsbF9ncmFudHMAAAAAAAAAAAABAAAD6gAAB9AAAAAFR3JhbnQAAAA=",
        "AAAAAAAAAAAAAAAPZ2V0X2dyYW50X2NvdW50AAAAAAAAAAABAAAABA==",
        "AAAABQAAAAAAAAAAAAAAF0dyYW50U3RhdHVzVXBkYXRlZEV2ZW50AAAAAAEAAAAaZ3JhbnRfc3RhdHVzX3VwZGF0ZWRfZXZlbnQAAAAAAAMAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAAAAAAKb2xkX3N0YXR1cwAAAAAH0AAAAAtHcmFudFN0YXR1cwAAAAAAAAAAAAAAAApuZXdfc3RhdHVzAAAAAAfQAAAAC0dyYW50U3RhdHVzAAAAAAAAAAAC",
        "AAAAAAAAAAAAAAARZ2V0X2dyYW50c19ieV9wdm8AAAAAAAABAAAAAAAAAAZwdm9faWQAAAAAAAQAAAABAAAD6gAAB9AAAAAFR3JhbnQAAAA=",
        "AAAAAAAAAAAAAAATZ2V0X2dyYW50c19ieV9kb25vcgAAAAABAAAAAAAAAAVkb25vcgAAAAAAABMAAAABAAAD6gAAB9AAAAAFR3JhbnQAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_grant: this.txFromJSON<Option<Grant>>,
        commit_grant: this.txFromJSON<u32>,
        update_status: this.txFromJSON<null>,
        get_all_grants: this.txFromJSON<Array<Grant>>,
        get_grant_count: this.txFromJSON<u32>,
        get_grants_by_pvo: this.txFromJSON<Array<Grant>>,
        get_grants_by_donor: this.txFromJSON<Array<Grant>>
  }
}