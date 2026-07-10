import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCZ3IEI6QUGRCVVN5BKVHNVI3UV3Y7J6FDXHFM2W75CMKNZNX3Q7W7YI";
    };
};
export type Role = {
    tag: "Citizen";
    values: void;
} | {
    tag: "Engineer";
    values: void;
} | {
    tag: "Inspector";
    values: void;
} | {
    tag: "Contractor";
    values: void;
} | {
    tag: "Supplier";
    values: void;
} | {
    tag: "GovernmentAgency";
    values: void;
} | {
    tag: "Auditor";
    values: void;
} | {
    tag: "CommissionOnAudit";
    values: void;
} | {
    tag: "AntiCorruptionAgency";
    values: void;
} | {
    tag: "FundingAgency";
    values: void;
} | {
    tag: "InternationalDonor";
    values: void;
} | {
    tag: "Administrator";
    values: void;
} | {
    tag: "AIAuditor";
    values: void;
} | {
    tag: "CentralBank";
    values: void;
};
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
    get_role: ({ address }: {
        address: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Option<RoleAssignment>>>;
    /**
     * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    has_role: ({ address, role }: {
        address: string;
        role: Role;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;
    /**
     * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    initialize: ({ admin }: {
        admin: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a assign_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    assign_role: ({ assigner, address, role }: {
        assigner: string;
        address: string;
        role: Role;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a revoke_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    revoke_role: ({ revoker, address, role }: {
        revoker: string;
        address: string;
        role: Role;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a has_any_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    has_any_role: ({ address, roles }: {
        address: string;
        roles: Array<Role>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>;
    /**
     * Construct and simulate a require_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    require_role: ({ address, role }: {
        address: string;
        role: Role;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_addresses_by_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_addresses_by_role: ({ role }: {
        role: Role;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_role: (json: string) => AssembledTransaction<Option<RoleAssignment>>;
        has_role: (json: string) => AssembledTransaction<boolean>;
        get_admin: (json: string) => AssembledTransaction<string>;
        initialize: (json: string) => AssembledTransaction<null>;
        assign_role: (json: string) => AssembledTransaction<null>;
        revoke_role: (json: string) => AssembledTransaction<null>;
        has_any_role: (json: string) => AssembledTransaction<boolean>;
        require_role: (json: string) => AssembledTransaction<null>;
        get_addresses_by_role: (json: string) => AssembledTransaction<string[]>;
    };
}
