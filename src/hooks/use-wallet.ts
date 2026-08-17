import { useCallback, useEffect, useState } from "react";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

export interface WalletState {
  address: string | null;
  isConnecting: boolean;
  hasProvider: boolean;
  isMetaMask: boolean;
  error: string | null;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasProvider = typeof window !== "undefined" && !!window.ethereum;
  const isMetaMask = hasProvider && !!window.ethereum?.isMetaMask;

  // Restore previously authorized account silently
  useEffect(() => {
    if (!hasProvider) return;
    const eth = window.ethereum!;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.[0]) setAddress(list[0].toLowerCase());
      })
      .catch(() => {});

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress(accounts?.[0]?.toLowerCase() ?? null);
    };
    eth.on?.("accountsChanged", handleAccounts);
    return () => {
      eth.removeListener?.("accountsChanged", handleAccounts);
    };
  }, [hasProvider]);

  const connect = useCallback(async () => {
    setError(null);
    if (!hasProvider) {
      setError("No Ethereum wallet detected. Install MetaMask to continue.");
      return null;
    }
    setIsConnecting(true);
    try {
      const accounts = (await window.ethereum!.request({
        method: "eth_requestAccounts",
      })) as string[];
      const addr = accounts?.[0]?.toLowerCase() ?? null;
      setAddress(addr);
      return addr;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection rejected";
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [hasProvider]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signMessage = useCallback(
    async (message: string) => {
      if (!hasProvider) throw new Error("No wallet provider");
      if (!address) throw new Error("Wallet not connected");
      const sig = (await window.ethereum!.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;
      return sig;
    },
    [address, hasProvider],
  );

  return {
    address,
    isConnecting,
    hasProvider,
    isMetaMask,
    error,
    connect,
    disconnect,
    signMessage,
  };
}

export function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
