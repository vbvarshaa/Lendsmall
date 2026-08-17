import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  parseEther,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import {
  MICROLEND_ABI,
  SEPOLIA_CHAIN_HEX,
  SEPOLIA_CHAIN_ID,
  getStoredContractAddress,
  setStoredContractAddress,
  type LoanStatus,
  type UiLoan,
} from "@/lib/contract";

export type TxKind = "CREATE" | "FUND" | "WITHDRAW" | "REPAY" | "CLAIM";

export interface TxRecord {
  kind: TxKind;
  hash: string;
  timestamp: number;
  signer: string;
  loanId?: string;
  amount?: number;
  detail?: string;
}

const TX_KEY = "microlend-tx-history";

function loadTxHistory(): TxRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveTxHistory(list: TxRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TX_KEY, JSON.stringify(list.slice(0, 100)));
}

function deriveStatus(
  amount: bigint,
  funded: bigint,
  repaid: bigint,
  totalDue: bigint,
  deadlineSec: bigint,
  nowMs: number,
): LoanStatus {
  if (totalDue > 0n && repaid >= totalDue) return "Repaid";
  if (funded >= amount && amount > 0n) return "Funded";
  if (deadlineSec * 1000n < BigInt(nowMs)) return "Expired";
  return "Pending";
}

export interface MicroLendState {
  contractAddress: Hex | null;
  setContractAddress: (addr: string | null) => void;
  hasProvider: boolean;
  chainId: number | null;
  isSepolia: boolean;
  switchToSepolia: () => Promise<void>;
  loans: UiLoan[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  txHistory: TxRecord[];
  createLoan: (
    borrower: string,
    amountEth: number,
    interestRate: number,
    deadlineMs: number,
  ) => Promise<string>;
  fundLoan: (loanId: string, amountEth: number) => Promise<string>;
  withdraw: (loanId: string) => Promise<string>;
  repayLoan: (loanId: string, amountEth: number) => Promise<string>;
  claimRepayment: (loanId: string) => Promise<string>;
}

export function useMicroLend(walletAddress: string | null): MicroLendState {
  const hasProvider = typeof window !== "undefined" && !!window.ethereum;
  const [contractAddress, setAddrState] = useState<Hex | null>(() =>
    getStoredContractAddress(),
  );
  const [chainId, setChainId] = useState<number | null>(null);
  const [loans, setLoans] = useState<UiLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHistory, setTxHistory] = useState<TxRecord[]>(() => loadTxHistory());
  const refreshing = useRef(false);

  // Track current chain
  useEffect(() => {
    if (!hasProvider) return;
    const eth = window.ethereum!;
    eth
      .request({ method: "eth_chainId" })
      .then((cid) => setChainId(parseInt(cid as string, 16)))
      .catch(() => {});
    const handler = (...args: unknown[]) => {
      const cid = args[0] as string;
      setChainId(parseInt(cid, 16));
    };
    eth.on?.("chainChanged", handler);
    return () => eth.removeListener?.("chainChanged", handler);
  }, [hasProvider]);

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;

  const setContractAddress = useCallback((addr: string | null) => {
    const cleaned = addr?.trim() || null;
    setStoredContractAddress(cleaned);
    setAddrState(cleaned && /^0x[a-fA-F0-9]{40}$/.test(cleaned) ? (cleaned as Hex) : null);
  }, []);

  const switchToSepolia = useCallback(async () => {
    if (!hasProvider) throw new Error("No wallet provider");
    try {
      await window.ethereum!.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await window.ethereum!.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_HEX,
              chainName: "Sepolia",
              nativeCurrency: { name: "SepoliaETH", symbol: "SEP", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw err;
      }
    }
  }, [hasProvider]);

  const publicClient = useMemo(() => {
    if (!hasProvider) return null;
    return createPublicClient({
      chain: sepolia,
      transport: custom(window.ethereum!),
    });
  }, [hasProvider, chainId]);

  const getWalletClient = useCallback(() => {
    if (!hasProvider) throw new Error("No wallet provider");
    if (!walletAddress) throw new Error("Wallet not connected");
    return createWalletClient({
      account: walletAddress as Hex,
      chain: sepolia,
      transport: custom(window.ethereum!),
    });
  }, [hasProvider, walletAddress]);

  const refresh = useCallback(async () => {
    if (!publicClient || !contractAddress || !isSepolia) {
      setLoans([]);
      return;
    }
    if (refreshing.current) return;
    refreshing.current = true;
    setLoading(true);
    setError(null);
    try {
      const count = (await publicClient.readContract({
        address: contractAddress,
        abi: MICROLEND_ABI,
        functionName: "loanCount",
      })) as bigint;

      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i));
      const now = Date.now();

      const results: UiLoan[] = await Promise.all(
        ids.map(async (id) => {
          const [loan, contribs, due] = await Promise.all([
            publicClient.readContract({
              address: contractAddress,
              abi: MICROLEND_ABI,
              functionName: "getLoan",
              args: [id],
            }) as Promise<{
              borrower: Hex;
              name: string;
              amount: bigint;
              interestRate: bigint;
              deadline: bigint;
              funded: bigint;
              repaid: bigint;
              withdrawn: boolean;
            }>,
            publicClient.readContract({
              address: contractAddress,
              abi: MICROLEND_ABI,
              functionName: "getContributions",
              args: [id],
            }) as Promise<readonly { lender: Hex; amount: bigint }[]>,
            publicClient.readContract({
              address: contractAddress,
              abi: MICROLEND_ABI,
              functionName: "totalDue",
              args: [id],
            }) as Promise<bigint>,
          ]);

          let myContribWei = 0n;
          if (walletAddress) {
            const me = walletAddress.toLowerCase();
            for (const c of contribs) {
              if (c.lender.toLowerCase() === me) myContribWei += c.amount;
            }
          }
          let myClaimedWei = 0n;
          if (walletAddress && myContribWei > 0n) {
            myClaimedWei = (await publicClient.readContract({
              address: contractAddress,
              abi: MICROLEND_ABI,
              functionName: "claimed",
              args: [id, walletAddress as Hex],
            })) as bigint;
          }
          let myClaimableWei = 0n;
          if (myContribWei > 0n && loan.amount > 0n) {
            const entitled = (loan.repaid * myContribWei) / loan.amount;
            const cap = (due * myContribWei) / loan.amount;
            const final = entitled > cap ? cap : entitled;
            myClaimableWei = final > myClaimedWei ? final - myClaimedWei : 0n;
          }

          return {
            id: id.toString(),
            borrower: loan.name,
            borrowerAddress: loan.borrower.toLowerCase(),
            amount: Number(formatEther(loan.amount)),
            interestRate: Number(loan.interestRate),
            deadline: Number(loan.deadline) * 1000,
            funded: Number(formatEther(loan.funded)),
            repaid: Number(formatEther(loan.repaid)),
            totalDue: Number(formatEther(due)),
            withdrawn: loan.withdrawn,
            status: deriveStatus(loan.amount, loan.funded, loan.repaid, due, loan.deadline, now),
            contributions: contribs.map((c) => ({
              lender: c.lender.toLowerCase(),
              amount: Number(formatEther(c.amount)),
            })),
            myContribution: Number(formatEther(myContribWei)),
            myClaimed: Number(formatEther(myClaimedWei)),
            myClaimable: Number(formatEther(myClaimableWei)),
          };
        }),
      );

      results.sort((a, b) => Number(b.id) - Number(a.id));
      setLoans(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load loans");
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, [publicClient, contractAddress, walletAddress, isSepolia]);

  // refresh on connect / config / chain changes + poll
  useEffect(() => {
    void refresh();
    if (!contractAddress || !isSepolia) return;
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh, contractAddress, isSepolia]);

  const recordTx = useCallback((rec: TxRecord) => {
    setTxHistory((prev) => {
      const next = [rec, ...prev].slice(0, 100);
      saveTxHistory(next);
      return next;
    });
  }, []);

  const ensureReady = useCallback(() => {
    if (!hasProvider) throw new Error("No wallet provider");
    if (!walletAddress) throw new Error("Connect MetaMask first");
    if (!contractAddress) throw new Error("Configure the contract address first");
    if (!isSepolia) throw new Error("Switch MetaMask to Sepolia");
  }, [hasProvider, walletAddress, contractAddress, isSepolia]);

  const sendAndWait = useCallback(
    async (
      kind: TxKind,
      sendFn: () => Promise<Hex>,
      meta: Omit<TxRecord, "kind" | "hash" | "timestamp" | "signer">,
    ) => {
      ensureReady();
      const hash = await sendFn();
      recordTx({
        kind,
        hash,
        timestamp: Date.now(),
        signer: walletAddress!.toLowerCase(),
        ...meta,
      });
      try {
        await publicClient!.waitForTransactionReceipt({ hash });
      } catch {
        /* swallow — show in history regardless */
      }
      void refresh();
      return hash;
    },
    [ensureReady, recordTx, publicClient, refresh, walletAddress],
  );

  const createLoan = useCallback(
    async (borrower: string, amountEth: number, interestRate: number, deadlineMs: number) => {
      ensureReady();
      const wc = getWalletClient();
      return sendAndWait(
        "CREATE",
        () =>
          wc.writeContract({
            address: contractAddress!,
            abi: MICROLEND_ABI,
            functionName: "createLoan",
            args: [
              borrower,
              parseEther(amountEth.toString()),
              BigInt(Math.round(interestRate)),
              BigInt(Math.floor(deadlineMs / 1000)),
            ],
          }),
        { amount: amountEth, detail: `${borrower} requested ${amountEth} Ξ @ ${interestRate}%` },
      );
    },
    [contractAddress, ensureReady, getWalletClient, sendAndWait],
  );

  const fundLoan = useCallback(
    async (loanId: string, amountEth: number) => {
      ensureReady();
      const wc = getWalletClient();
      return sendAndWait(
        "FUND",
        () =>
          wc.writeContract({
            address: contractAddress!,
            abi: MICROLEND_ABI,
            functionName: "fundLoan",
            args: [BigInt(loanId)],
            value: parseEther(amountEth.toString()),
          }),
        { loanId, amount: amountEth, detail: `Funded ${amountEth} Ξ → #${loanId}` },
      );
    },
    [contractAddress, ensureReady, getWalletClient, sendAndWait],
  );

  const withdraw = useCallback(
    async (loanId: string) => {
      ensureReady();
      const wc = getWalletClient();
      return sendAndWait(
        "WITHDRAW",
        () =>
          wc.writeContract({
            address: contractAddress!,
            abi: MICROLEND_ABI,
            functionName: "withdraw",
            args: [BigInt(loanId)],
          }),
        { loanId, detail: `Withdrew principal of #${loanId}` },
      );
    },
    [contractAddress, ensureReady, getWalletClient, sendAndWait],
  );

  const repayLoan = useCallback(
    async (loanId: string, amountEth: number) => {
      ensureReady();
      const wc = getWalletClient();
      return sendAndWait(
        "REPAY",
        () =>
          wc.writeContract({
            address: contractAddress!,
            abi: MICROLEND_ABI,
            functionName: "repayLoan",
            args: [BigInt(loanId)],
            value: parseEther(amountEth.toString()),
          }),
        { loanId, amount: amountEth, detail: `Repaid ${amountEth} Ξ → #${loanId}` },
      );
    },
    [contractAddress, ensureReady, getWalletClient, sendAndWait],
  );

  const claimRepayment = useCallback(
    async (loanId: string) => {
      ensureReady();
      const wc = getWalletClient();
      return sendAndWait(
        "CLAIM",
        () =>
          wc.writeContract({
            address: contractAddress!,
            abi: MICROLEND_ABI,
            functionName: "claimRepayment",
            args: [BigInt(loanId)],
          }),
        { loanId, detail: `Claimed repayment from #${loanId}` },
      );
    },
    [contractAddress, ensureReady, getWalletClient, sendAndWait],
  );

  return {
    contractAddress,
    setContractAddress,
    hasProvider,
    chainId,
    isSepolia,
    switchToSepolia,
    loans,
    loading,
    error,
    refresh,
    txHistory,
    createLoan,
    fundLoan,
    withdraw,
    repayLoan,
    claimRepayment,
  };
}
