// Simulated blockchain backed by REAL MetaMask signatures. The chain is an
// append-only list of blocks; each transaction is signed by the user's wallet
// via personal_sign. The block hash links to the previous block, so the chain
// is tamper-evident, and every transaction is cryptographically attributable
// to a specific Ethereum address.

import { verifyMessage, type Hex } from "viem";

export type TxType =
  | {
      kind: "CREATE_LOAN";
      loanId: string;
      borrower: string; // human-readable display name
      signer: string; // wallet address (lowercase)
      amount: number;
      interestRate: number;
      deadline: number;
    }
  | {
      kind: "FUND_LOAN";
      loanId: string;
      signer: string;
      amount: number;
    }
  | {
      kind: "REPAY_LOAN";
      loanId: string;
      signer: string;
      amount: number;
    };

export interface Block {
  index: number;
  timestamp: number;
  tx: TxType;
  prevHash: string;
  hash: string;
  signature: string; // EIP-191 personal_sign over the block hash
}

export interface Contribution {
  signer: string;
  amount: number;
  timestamp: number;
  txHash: string;
  signature: string;
}

export interface Repayment {
  signer: string;
  amount: number;
  timestamp: number;
  txHash: string;
}

export type LoanStatus = "Pending" | "Funded" | "Repaid" | "Expired";

export interface Loan {
  id: string;
  borrower: string;
  borrowerAddress: string;
  amount: number;
  interestRate: number;
  deadline: number;
  funded: number;
  repaid: number;
  totalDue: number;
  status: LoanStatus;
  createdAt: number;
  contributions: Contribution[];
  repayments: Repayment[];
}

// FNV-1a 64-bit-ish (two 32-bit lanes). Deterministic, dependency-free.
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  let h2 = 0x811c9dc5;
  const salt = input + h.toString(16);
  for (let i = 0; i < salt.length; i++) {
    h2 ^= salt.charCodeAt(i);
    h2 = (h2 + ((h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

const GENESIS_PREV = "0".repeat(16);

export function buildBlockHash(
  prev: Block | null,
  tx: TxType,
  timestamp: number,
): { index: number; prevHash: string; timestamp: number; hash: string } {
  const index = prev ? prev.index + 1 : 0;
  const prevHash = prev ? prev.hash : GENESIS_PREV;
  const payload = JSON.stringify({ index, timestamp, tx, prevHash });
  return { index, prevHash, timestamp, hash: hash(payload) };
}

export function assembleBlock(
  prev: Block | null,
  tx: TxType,
  timestamp: number,
  signature: string,
): Block {
  const { index, prevHash, hash: h } = buildBlockHash(prev, tx, timestamp);
  return { index, timestamp, tx, prevHash, hash: h, signature };
}

export function verifyChain(chain: Block[]): boolean {
  for (let i = 0; i < chain.length; i++) {
    const b = chain[i];
    const expectedPrev = i === 0 ? GENESIS_PREV : chain[i - 1].hash;
    if (b.prevHash !== expectedPrev) return false;
    const payload = JSON.stringify({
      index: b.index,
      timestamp: b.timestamp,
      tx: b.tx,
      prevHash: b.prevHash,
    });
    if (hash(payload) !== b.hash) return false;
  }
  return true;
}

// Async verification of every block's MetaMask signature against tx.signer.
export async function verifySignatures(chain: Block[]): Promise<boolean> {
  for (const b of chain) {
    try {
      const ok = await verifyMessage({
        address: b.tx.signer as Hex,
        message: b.hash,
        signature: b.signature as Hex,
      });
      if (!ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function computeStatus(loan: Loan, now: number): LoanStatus {
  if (loan.repaid >= loan.totalDue && loan.totalDue > 0) return "Repaid";
  if (loan.funded >= loan.amount) return "Funded";
  if (now > loan.deadline) return "Expired";
  return "Pending";
}

export function loansFromChain(chain: Block[], now: number = Date.now()): Loan[] {
  const loans = new Map<string, Loan>();
  for (const block of chain) {
    const tx = block.tx;
    if (tx.kind === "CREATE_LOAN") {
      const totalDue = tx.amount * (1 + tx.interestRate / 100);
      loans.set(tx.loanId, {
        id: tx.loanId,
        borrower: tx.borrower,
        borrowerAddress: tx.signer,
        amount: tx.amount,
        interestRate: tx.interestRate,
        deadline: tx.deadline,
        funded: 0,
        repaid: 0,
        totalDue,
        status: "Pending",
        createdAt: block.timestamp,
        contributions: [],
        repayments: [],
      });
    } else if (tx.kind === "FUND_LOAN") {
      const loan = loans.get(tx.loanId);
      if (!loan) continue;
      loan.contributions.push({
        signer: tx.signer,
        amount: tx.amount,
        timestamp: block.timestamp,
        txHash: block.hash,
        signature: block.signature,
      });
      loan.funded += tx.amount;
    } else if (tx.kind === "REPAY_LOAN") {
      const loan = loans.get(tx.loanId);
      if (!loan) continue;
      loan.repayments.push({
        signer: tx.signer,
        amount: tx.amount,
        timestamp: block.timestamp,
        txHash: block.hash,
      });
      loan.repaid += tx.amount;
    }
  }
  for (const loan of loans.values()) {
    loan.status = computeStatus(loan, now);
  }
  return Array.from(loans.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function describeTx(tx: TxType): string {
  switch (tx.kind) {
    case "CREATE_LOAN":
      return `${tx.borrower} requested ${tx.amount.toFixed(2)} Ξ @ ${tx.interestRate}%`;
    case "FUND_LOAN":
      return `Funded ${tx.amount.toFixed(2)} Ξ → #${tx.loanId}`;
    case "REPAY_LOAN":
      return `Repayment of ${tx.amount.toFixed(2)} Ξ → #${tx.loanId}`;
  }
}
