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
    contractId: "CBDWHDIO637P7XCYEQMO52LMJBNOJYSALCWSGUJ2RQKRRDDME34MA746",
  }
} as const

export type Role = {tag: "Citizen", values: void} | {tag: "Engineer", values: void} | {tag: "Inspector", values: void} | {tag: "Contractor", values: void} | {tag: "Supplier", values: void} | {tag: "GovernmentAgency", values: void} | {tag: "Auditor", values: void} | {tag: "CommissionOnAudit", values: void} | {tag: "AntiCorruptionAgency", values: void} | {tag: "FundingAgency", values: void} | {tag: "InternationalDonor", values: void} | {tag: "Administrator", values: void} | {tag: "AIAuditor", values: void};


export interface RoleAssignment {
  active: boolean;
  address: string;
  assigned_at: u64;
  assigned_by: string;
  role: Role;
}



export interface Client {
  /**
   * Construct and simulate a get_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_role: ({address}: {address: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<RoleAssignment>>>

  /**
   * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  has_role: ({address, role}: {address: string, role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a assign_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  assign_role: ({assigner, address, role}: {assigner: string, address: string, role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a revoke_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke_role: ({revoker, address, role}: {revoker: string, address: string, role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a has_any_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  has_any_role: ({address, roles}: {address: string, roles: Array<Role>}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a require_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  require_role: ({address, role}: {address: string, role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_addresses_by_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_addresses_by_role: ({role}: {role: Role}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

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
      new ContractSpec([ "AAAAAgAAAAAAAAAAAAAABFJvbGUAAAANAAAAAAAAAAAAAAAHQ2l0aXplbgAAAAAAAAAAAAAAAAhFbmdpbmVlcgAAAAAAAAAAAAAACUluc3BlY3RvcgAAAAAAAAAAAAAAAAAACkNvbnRyYWN0b3IAAAAAAAAAAAAAAAAACFN1cHBsaWVyAAAAAAAAAAAAAAAQR292ZXJubWVudEFnZW5jeQAAAAAAAAAAAAAAB0F1ZGl0b3IAAAAAAAAAAAAAAAARQ29tbWlzc2lvbk9uQXVkaXQAAAAAAAAAAAAAAAAAABRBbnRpQ29ycnVwdGlvbkFnZW5jeQAAAAAAAAAAAAAADUZ1bmRpbmdBZ2VuY3kAAAAAAAAAAAAAAAAAABJJbnRlcm5hdGlvbmFsRG9ub3IAAAAAAAAAAAAAAAAADUFkbWluaXN0cmF0b3IAAAAAAAAAAAAAAAAAAAlBSUF1ZGl0b3IAAAA=",
        "AAAAAQAAAAAAAAAAAAAADlJvbGVBc3NpZ25tZW50AAAAAAAFAAAAAAAAAAZhY3RpdmUAAAAAAAEAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAAAAAALYXNzaWduZWRfYXQAAAAABgAAAAAAAAALYXNzaWduZWRfYnkAAAAAEwAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQ==",
        "AAAAAAAAAAAAAAAIZ2V0X3JvbGUAAAABAAAAAAAAAAdhZGRyZXNzAAAAABMAAAABAAAD6AAAB9AAAAAOUm9sZUFzc2lnbm1lbnQAAA==",
        "AAAAAAAAAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAQAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAA==",
        "AAAABQAAAAAAAAAAAAAAEFJvbGVSZXZva2VkRXZlbnQAAAABAAAAEnJvbGVfcmV2b2tlZF9ldmVudAAAAAAAAwAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQAAAAAAAAAAAAAACnJldm9rZWRfYnkAAAAAABMAAAAAAAAAAg==",
        "AAAAAAAAAAAAAAALYXNzaWduX3JvbGUAAAAAAwAAAAAAAAAIYXNzaWduZXIAAAATAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAAA",
        "AAAAAAAAAAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHcmV2b2tlcgAAAAATAAAAAAAAAAdhZGRyZXNzAAAAABMAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAAA",
        "AAAABQAAAAAAAAAAAAAAEVJvbGVBc3NpZ25lZEV2ZW50AAAAAAAAAQAAABNyb2xlX2Fzc2lnbmVkX2V2ZW50AAAAAAMAAAAAAAAAB2FkZHJlc3MAAAAAEwAAAAAAAAAAAAAABHJvbGUAAAfQAAAABFJvbGUAAAAAAAAAAAAAAAthc3NpZ25lZF9ieQAAAAATAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAMaGFzX2FueV9yb2xlAAAAAgAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAVyb2xlcwAAAAAAA+oAAAfQAAAABFJvbGUAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAMcmVxdWlyZV9yb2xlAAAAAgAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAARyb2xlAAAH0AAAAARSb2xlAAAAAA==",
        "AAAAAAAAAAAAAAAVZ2V0X2FkZHJlc3Nlc19ieV9yb2xlAAAAAAAAAQAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQAAAAEAAAPqAAAAEw==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_role: this.txFromJSON<Option<RoleAssignment>>,
        has_role: this.txFromJSON<boolean>,
        get_admin: this.txFromJSON<string>,
        initialize: this.txFromJSON<null>,
        assign_role: this.txFromJSON<null>,
        revoke_role: this.txFromJSON<null>,
        has_any_role: this.txFromJSON<boolean>,
        require_role: this.txFromJSON<null>,
        get_addresses_by_role: this.txFromJSON<Array<string>>
  }
}