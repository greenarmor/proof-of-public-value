/**
 * Transaction Builder API - Vercel Serverless Function
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, params, signedXdr, txXdr, signature, publicKey } = req.body || {};

    // Submit pre-signed XDR
    if (signedXdr) {
      const { rpc, TransactionBuilder } = await import("@stellar/stellar-sdk");
      const NETWORK = "Test SDF Network ; September 2015";
      const server = new rpc.Server("https://soroban-testnet.stellar.org:443");
      const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
      const result = await server.sendTransaction(tx);
      if (result.status === "PENDING" || result.status === "DUPLICATE") {
        return res.status(200).json({ success: true, txHash: result.hash });
      }
      return res.status(500).json({ error: "Tx status: " + result.status });
    }

    // Assemble signed envelope
    if (txXdr && signature && publicKey) {
      const { TransactionBuilder, xdr, Keypair, rpc } = await import("@stellar/stellar-sdk");
      const NETWORK = "Test SDF Network ; September 2015";
      const server = new rpc.Server("https://soroban-testnet.stellar.org:443");
      const tx = TransactionBuilder.fromXDR(txXdr, NETWORK);
      const sigBytes = Buffer.from(signature, "hex");
      const hint = Keypair.fromPublicKey(publicKey).rawPublicKey().slice(-4);
      tx.signatures.push(new xdr.DecoratedSignature({ hint, signature: sigBytes }));
      const result = await server.sendTransaction(tx);
      if (result.status === "PENDING" || result.status === "DUPLICATE") {
        return res.status(200).json({ success: true, txHash: result.hash });
      }
      return res.status(500).json({ error: "Tx status: " + result.status });
    }

    // Build unsigned XDR
    if (!type || !params) {
      return res.status(400).json({ error: "type and params required" });
    }

    const { Keypair, Asset, Operation, TransactionBuilder, Contract, xdr, nativeToScVal, Address } = await import("@stellar/stellar-sdk");
    const RPC_URL = "https://soroban-testnet.stellar.org:443";
    const HORIZON = "https://horizon-testnet.stellar.org";
    const NETWORK = "Test SDF Network ; September 2015";
    const RPT_ISSUER = "GBDNQETDDXGJ42PTL2ODGTBSNV6BYN5P7T3CF27JCN7KT2QMJOEACMSV";
    const PPHP_ISSUER = "GBRDP6UQ625API2MGOMSV3Z3ZWJIABCDCKGOOCOCJNNZYNZ32XYBBBHO";
    const COMMUNITY_ORACLE = "CCMVMF2ZJUULQFDZW2WA5GUORCKU2QIJOZC7TKKPPOJUTRTKN3JPUP32";
    const rpcServer = new rpc.Server(RPC_URL);

    if (type === "trustline") {
      const { address } = params;
      if (!address) return res.status(400).json({ error: "address required" });

      const account = await rpcServer.getAccount(address);
      const source = { accountId: () => address, sequenceNumber: () => account.sequenceNumber(), incrementSequenceNumber: () => {} };
      const tx = new TransactionBuilder(source, { fee: "100000", networkPassphrase: NETWORK }).setTimeout(30);

      const acctR = await fetch(HORIZON + "/accounts/" + address);
      const acct = await acctR.json();
      const balances = acct.balances || [];
      const hasRpt = balances.some(function(b) { return b.asset_code === "RPT" && b.asset_issuer === RPT_ISSUER; });
      const hasPphp = balances.some(function(b) { return b.asset_code === "pPHP" && b.asset_issuer === PPHP_ISSUER; });

      if (!hasRpt) tx.addOperation(Operation.changeTrust({ asset: new Asset("RPT", RPT_ISSUER) }));
      if (!hasPphp) tx.addOperation(Operation.changeTrust({ asset: new Asset("pPHP", PPHP_ISSUER) }));

      const builtTx = tx.build();
      const hash = builtTx.hash();
      return res.status(200).json({ txXdr: builtTx.toXDR(), signHash: hash.toString("hex") });
    }

    if (type === "payment") {
      const { address, destination, amount, asset: assetType } = params;
      if (!address || !destination) return res.status(400).json({ error: "address and destination required" });

      const account = await rpcServer.getAccount(address);
      const source = { accountId: () => address, sequenceNumber: () => account.sequenceNumber(), incrementSequenceNumber: () => {} };

      var paymentAsset;
      if (assetType === "XLM" || !assetType) paymentAsset = Asset.native();
      else if (assetType === "RPT") paymentAsset = new Asset("RPT", RPT_ISSUER);
      else if (assetType === "pPHP") paymentAsset = new Asset("pPHP", PPHP_ISSUER);

      const tx = new TransactionBuilder(source, { fee: "100000", networkPassphrase: NETWORK })
        .addOperation(Operation.payment({ destination: destination, asset: paymentAsset, amount: String(amount) }))
        .setTimeout(30).build();

      const hash = tx.hash();
      return res.status(200).json({ txXdr: tx.toXDR(), signHash: hash.toString("hex") });
    }

    if (type === "report") {
      const { address, pvoId, milestoneId, lat, lng, ipfsHash } = params;
      if (!address || !pvoId) return res.status(400).json({ error: "address and pvoId required" });

      const account = await rpcServer.getAccount(address);
      const source = { accountId: () => address, sequenceNumber: () => account.sequenceNumber(), incrementSequenceNumber: () => {} };
      const dataHash = ipfsHash || ("mobile:" + Date.now() + ":" + lat + ":" + lng).slice(0, 64);
      const latMicro = Math.round((lat || 0) * 1000000);
      const lngMicro = Math.round((lng || 0) * 1000000);

      const contract = new Contract(COMMUNITY_ORACLE);
      const op = contract.call(
        "submit_report",
        new Address(address).toScVal(),
        xdr.ScVal.scvU32(pvoId),
        xdr.ScVal.scvU32(milestoneId || 1),
        xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("GpsPhoto")]),
        xdr.ScVal.scvString(dataHash),
        nativeToScVal(latMicro, { type: "i128" }),
        nativeToScVal(lngMicro, { type: "i128" }),
      );

      const tx = new TransactionBuilder(source, { fee: "100000", networkPassphrase: NETWORK })
        .addOperation(op).setTimeout(30).build();

      const prepared = await rpcServer.prepareTransaction(tx);
      const hash = prepared.hash();
      return res.status(200).json({ txXdr: prepared.toXDR(), signHash: hash.toString("hex") });
    }

    return res.status(400).json({ error: "Unknown tx type: " + type });
  } catch (err) {
    return res.status(500).json({ error: (err.message || "Unknown error").slice(0, 200) });
  }
}
