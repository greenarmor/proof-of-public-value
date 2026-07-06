import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { isConnected, getAddress, requestAccess, WatchWalletChanges } from "@stellar/freighter-api";
import { Client as AccessControlClient } from "./contracts/access_control/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "./config";

export type Role = string;

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  roles: Role[];
  connect: () => Promise<void>;
  disconnect: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  async function fetchRoles(addr: string) {
    try {
      const client = new AccessControlClient({
        contractId: CONTRACT_IDS.access_control,
        networkPassphrase: NETWORK_PASSPHRASE,
        rpcUrl: RPC_URL,
      });
      const result = await client.get_role({ address: addr });
      if (result.result) {
        const role = result.result.role;
        setRoles([typeof role === "string" ? role : (role as any).tag || ""]);
      } else {
        setRoles([]);
      }
    } catch {
      setRoles([]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function checkWithRetry(attempt = 0) {
      if (cancelled) return;
      try {
        const c = await isConnected();
        if (c) {
          if (cancelled) return;
          const r = await getAddress();
          if (cancelled) return;
          setAddress(r.address);
          fetchRoles(r.address);
        } else if (attempt < 10) {
          setTimeout(() => checkWithRetry(attempt + 1), 500);
        } else {
          setAddress(null);
          setRoles([]);
        }
      } catch {
        if (attempt < 10) {
          setTimeout(() => checkWithRetry(attempt + 1), 500);
        } else {
          setAddress(null);
          setRoles([]);
        }
      }
    }

    const timer = setTimeout(() => checkWithRetry(), 300);
    const watcher = new WatchWalletChanges(60000);
    watcher.watch(() => {
      if (!cancelled) checkConnection();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      watcher.stop();
    };
  }, []);

  async function checkConnection() {
    try {
      const c = await isConnected();
      if (c) {
        const r = await getAddress();
        setAddress(r.address);
        fetchRoles(r.address);
      } else {
        setAddress(null);
        setRoles([]);
      }
    } catch {
      setAddress(null);
      setRoles([]);
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
    setRoles([]);
  }, []);

  const hasRole = useCallback((...needed: Role[]) => {
    return needed.some((r) => roles.includes(r));
  }, [roles]);

  return (
    <WalletContext.Provider value={{ address, connected: !!address, roles, connect, disconnect, hasRole }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
