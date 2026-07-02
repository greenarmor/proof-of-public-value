import { createContext, useContext, useState, useCallback, ReactNode } from "react";
// @ts-ignore - FreighterModule is not in the package exports type map
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";

// @ts-ignore - modules will use default Freighter at runtime
StellarWalletsKit.init({
  network: Networks.TESTNET,
});

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      const result = await StellarWalletsKit.getAddress();
      setAddress(result.address);
    } catch (e) {
      console.error("Wallet connection failed:", e);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch (e) {
      console.error("Wallet disconnect failed:", e);
    }
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider value={{ address, connected: !!address, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
