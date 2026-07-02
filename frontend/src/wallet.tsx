import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  WatchWalletChanges,
} from "@stellar/freighter-api";

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
    const watcher = new WatchWalletChanges(60000);
    watcher.watch(() => checkConnection());
    return () => watcher.stop();
  }, []);

  async function checkConnection() {
    try {
      const connected = await isConnected();
      if (connected) {
        const result = await getAddress();
        setAddress(result.address);
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    }
  }

  const connect = useCallback(async () => {
    try {
      await requestAccess();
      await checkConnection();
    } catch (e) {
      console.error("Freighter connection failed:", e);
    }
  }, []);

  const disconnect = useCallback(() => {
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
