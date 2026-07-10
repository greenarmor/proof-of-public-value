import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
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
        contractId: "CCZ3IEI6QUGRCVVN5BKVHNVI3UV3Y7J6FDXHFM2W75CMKNZNX3Q7W7YI",
    }
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy(null, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAgAAAAAAAAAAAAAABFJvbGUAAAAOAAAAAAAAAAAAAAAHQ2l0aXplbgAAAAAAAAAAAAAAAAhFbmdpbmVlcgAAAAAAAAAAAAAACUluc3BlY3RvcgAAAAAAAAAAAAAAAAAACkNvbnRyYWN0b3IAAAAAAAAAAAAAAAAACFN1cHBsaWVyAAAAAAAAAAAAAAAQR292ZXJubWVudEFnZW5jeQAAAAAAAAAAAAAAB0F1ZGl0b3IAAAAAAAAAAAAAAAARQ29tbWlzc2lvbk9uQXVkaXQAAAAAAAAAAAAAAAAAABRBbnRpQ29ycnVwdGlvbkFnZW5jeQAAAAAAAAAAAAAADUZ1bmRpbmdBZ2VuY3kAAAAAAAAAAAAAAAAAABJJbnRlcm5hdGlvbmFsRG9ub3IAAAAAAAAAAAAAAAAADUFkbWluaXN0cmF0b3IAAAAAAAAAAAAAAAAAAAlBSUF1ZGl0b3IAAAAAAAAAAAAAAAAAAAtDZW50cmFsQmFuawA=",
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
            "AAAAAAAAAAAAAAAVZ2V0X2FkZHJlc3Nlc19ieV9yb2xlAAAAAAAAAQAAAAAAAAAEcm9sZQAAB9AAAAAEUm9sZQAAAAEAAAPqAAAAEw=="]), options);
        this.options = options;
    }
    fromJSON = {
        get_role: (this.txFromJSON),
        has_role: (this.txFromJSON),
        get_admin: (this.txFromJSON),
        initialize: (this.txFromJSON),
        assign_role: (this.txFromJSON),
        revoke_role: (this.txFromJSON),
        has_any_role: (this.txFromJSON),
        require_role: (this.txFromJSON),
        get_addresses_by_role: (this.txFromJSON)
    };
}
