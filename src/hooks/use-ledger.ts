import { useCallback, useEffect, useState } from "react";
import {
  type Block,
  type Loan,
  type TxType,
  assembleBlock,
  buildBlockHash,
  loansFromChain,
  newId,
  verifyChain,
  verifySignatures,
} from "@/lib/blockchain";

const STORAGE_KEY = "microlend-chain-v3";

function loadChain(): Block[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Block[];
    if (!Array.isArray(parsed)) return [];
    return verifyChain(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChain(chain: Block[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
}

type SignFn = (message: string) => Promise<string>;

export interface LedgerState {
  chain: Block[];
  loans: Loan[];
  valid: boolean;
  signaturesValid: boolean | null;
  createLoan: (
    signer: string,
    sign: SignFn,
    borrower: string,
    amount: number,
    interestRate: number,
    deadline: number,
  ) => Promise<string>;
  fundLoan: (
    signer: string,
    sign: SignFn,
    loanId: string,
    amount: number,
  ) => Promise<void>;
  repayLoan: (
    signer: string,
    sign: SignFn,
    loanId: string,
    amount: number,
  ) => Promise<void>;
  reset: () => void;
}

export function useLedger(): LedgerState {
  const [chain, setChain] = useState<Block[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [signaturesValid, setSignaturesValid] = useState<boolean | null>(null);

  useEffect(() => {
    setChain(loadChain());
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (chain.length === 0) {
      setSignaturesValid(null);
      return;
    }
    verifySignatures(chain).then((ok) => {
      if (!cancelled) setSignaturesValid(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [chain]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const append = useCallback(
    async (tx: TxType, sign: SignFn) => {
      const prev = chain[chain.length - 1] ?? null;
      const timestamp = Date.now();
      const { hash } = buildBlockHash(prev, tx, timestamp);
      const signature = await sign(hash);
      const block = assembleBlock(prev, tx, timestamp, signature);
      const next = [...chain, block];
      saveChain(next);
      setChain(next);
    },
    [chain],
  );

  const createLoan = useCallback(
    async (
      signer: string,
      sign: SignFn,
      borrower: string,
      amount: number,
      interestRate: number,
      deadline: number,
    ) => {
      const loanId = newId();
      await append(
        {
          kind: "CREATE_LOAN",
          loanId,
          borrower,
          signer: signer.toLowerCase(),
          amount,
          interestRate,
          deadline,
        },
        sign,
      );
      return loanId;
    },
    [append],
  );

  const fundLoan = useCallback(
    async (signer: string, sign: SignFn, loanId: string, amount: number) => {
      await append(
        { kind: "FUND_LOAN", loanId, signer: signer.toLowerCase(), amount },
        sign,
      );
    },
    [append],
  );

  const repayLoan = useCallback(
    async (signer: string, sign: SignFn, loanId: string, amount: number) => {
      await append(
        { kind: "REPAY_LOAN", loanId, signer: signer.toLowerCase(), amount },
        sign,
      );
    },
    [append],
  );

  const reset = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setChain([]);
  }, []);

  return {
    chain,
    loans: loansFromChain(chain, now),
    valid: verifyChain(chain),
    signaturesValid,
    createLoan,
    fundLoan,
    repayLoan,
    reset,
  };
}
