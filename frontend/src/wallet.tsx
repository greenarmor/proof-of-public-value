import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { isConnected, getAddress, requestAccess, WatchWalletChanges, signTransaction as freighterSign } from "@stellar/freighter-api";
import { Client as AccessControlClient } from "./contracts/access_control/src";
import { NETWORK_PASSPHRASE, RPC_URL, CONTRACT_IDS } from "./config";
import { SignClient } from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";
import { WalletConnectModal } from "@walletconnect/modal";

export type Role = string;
export type WalletType = "freighter" | "walletconnect" | null;

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  roles: Role[];
  walletType: WalletType;
  connect: () => Promise<void>;
  connectMobile: () => Promise<void>;
  disconnect: () => void;
  hasRole: (...roles: Role[]) => boolean;
  signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<{ signedTxXdr: string }>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ── WalletConnect Setup ──────────────────────────────────
const WC_PROJECT_ID = 
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_WC_PROJECT_ID) ||
  (typeof window !== "undefined" && (window as any).__WC_PROJECT_ID__) ||
  "";
const STELLAR_CHAIN = "stellar:testnet";
const STELLAR_METHODS = ["stellar_signAndSubmit", "stellar_signXdr"];
const STELLAR_EVENTS = ["chainChanged", "accountsChanged"];

let wcClient: InstanceType<typeof SignClient> | null = null;
let wcSession: SessionTypes.Struct | null = null;

async function getWcClient(): Promise<InstanceType<typeof SignClient>> {
  if (!wcClient) {
    wcClient = await SignClient.init({
      projectId: WC_PROJECT_ID,
      metadata: {
        name: "Proof of Public Value",
        description: "Government spending accountability on Stellar",
        url: typeof window !== "undefined" ? window.location.origin : "https://www.popv.quest",
        icons: [],
      },
    });
  }
  return wcClient;
}

async function getMobilePublicKey(): Promise<string | null> {
  if (!wcSession) return null;
  const accounts = wcSession.namespaces.stellar?.accounts || [];
  if (accounts.length === 0) return null;
  // Format: "stellar:testnet:GABC..."
  const parts = accounts[0].split(":");
  return parts[parts.length - 1] || null;
}

// ── Provider ─────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [walletType, setWalletType] = useState<WalletType>(null);

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

  // Freighter auto-detect on mount
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
          setWalletType("freighter");
          fetchRoles(r.address);
        } else if (attempt < 10) {
          setTimeout(() => checkWithRetry(attempt + 1), 500);
        }
      } catch {
        if (attempt < 10) {
          setTimeout(() => checkWithRetry(attempt + 1), 500);
        }
      }
    }

    const timer = setTimeout(() => checkWithRetry(), 300);

    // Restore WalletConnect session
    (async () => {
      try {
        const client = await getWcClient();
        const sessions = client.session.getAll();
        if (sessions.length > 0) {
          wcSession = sessions[0];
          const pk = await getMobilePublicKey();
          if (pk) {
            setAddress(pk);
            setWalletType("walletconnect");
            fetchRoles(pk);
            // Register session listener for auto-restored sessions too
            client.on("session_delete", () => {
              wcSession = null;
              setAddress(null);
              setWalletType(null);
              setRoles([]);
            });
          }
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      try { await isConnected(); } catch {
        window.open("https://freighter.app", "_blank");
        return;
      }
      await requestAccess();
      const r = await getAddress();
      setAddress(r.address);
      setWalletType("freighter");
      fetchRoles(r.address);
    } catch (e) {
      console.error("Freighter connection failed:", e);
    }
  }, []);

  const connectMobile = useCallback(async () => {
    try {
      const client = await getWcClient();

      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          stellar: {
            methods: STELLAR_METHODS,
            chains: [STELLAR_CHAIN],
            events: STELLAR_EVENTS,
          },
        },
      });

      if (uri) {
        const modal = new WalletConnectModal({ projectId: WC_PROJECT_ID });
        await modal.openModal({ uri });
        wcSession = await approval();
        modal.closeModal();
      } else {
        wcSession = await approval();
      }

      const pk = await getMobilePublicKey();
      if (pk) {
        setAddress(pk);
        setWalletType("walletconnect");
        fetchRoles(pk);

        // Listen for session events
        let lastConnected = Date.now();
        client.on("session_delete", () => {
          // Ignore if just connected (prevent flash logout)
          if (Date.now() - lastConnected < 10000) return;
          wcSession = null;
          setAddress(null);
          setWalletType(null);
          setRoles([]);
        });
      }
    } catch (e: any) {
      if (e?.message !== "User rejected") {
        console.error("WalletConnect failed:", e?.message || e);
        alert("Mobile connect failed: " + (e?.message || "Unknown error").slice(0, 100));
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (walletType === "walletconnect" && wcSession) {
      try {
        const client = await getWcClient();
        await client.disconnect({ topic: wcSession.topic, reason: { code: 6000, message: "User disconnected" } });
        wcSession = null;
      } catch {}
    }
    setAddress(null);
    setWalletType(null);
    setRoles([]);
  }, [walletType]);

  const signTx = useCallback(async (xdr: string, opts?: { networkPassphrase?: string }): Promise<{ signedTxXdr: string }> => {
    if (walletType === "freighter") {
      return freighterSign(xdr, { networkPassphrase: opts?.networkPassphrase || NETWORK_PASSPHRASE });
    }
    if (walletType === "walletconnect" && wcSession) {
      const client = await getWcClient();
      const result = await client.request({
        topic: wcSession.topic,
        chainId: STELLAR_CHAIN,
        request: {
          method: "stellar_signXdr",
          params: { xdr, networkPassphrase: opts?.networkPassphrase || NETWORK_PASSPHRASE },
        },
      });
      return { signedTxXdr: (result as any).signedXdr || (result as any).signedTxXdr };
    }
    throw new Error("No wallet connected");
  }, [walletType]);

  const hasRole = useCallback((...needed: Role[]) => {
    return needed.some((r) => roles.includes(r));
  }, [roles]);

  return (
    <WalletContext.Provider value={{
      address,
      connected: !!address,
      roles,
      walletType,
      connect,
      connectMobile,
      disconnect,
      hasRole,
      signTransaction: signTx,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
