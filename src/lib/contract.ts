// MicroLend contract glue: ABI, address management, network config.
import type { Hex } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

const ADDRESS_KEY = "microlend-contract-address";

export function getStoredContractAddress(): Hex | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(ADDRESS_KEY);
  if (v && /^0x[a-fA-F0-9]{40}$/.test(v)) return v as Hex;
  return null;
}

export function setStoredContractAddress(addr: string | null) {
  if (typeof window === "undefined") return;
  if (!addr) {
    window.localStorage.removeItem(ADDRESS_KEY);
    return;
  }
  window.localStorage.setItem(ADDRESS_KEY, addr);
}

export function txExplorerUrl(hash: string) {
  return `${SEPOLIA_EXPLORER}/tx/${hash}`;
}
export function addressExplorerUrl(addr: string) {
  return `${SEPOLIA_EXPLORER}/address/${addr}`;
}

// Minimal ABI: matches contracts/MicroLend.sol
export const MICROLEND_ABI = [
  {
    type: "function",
    name: "createLoan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "amount", type: "uint256" },
      { name: "interestRate", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundLoan",
    stateMutability: "payable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "repayLoan",
    stateMutability: "payable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRepayment",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "loanCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalDue",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getLoan",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "borrower", type: "address" },
          { name: "name", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "interestRate", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "funded", type: "uint256" },
          { name: "repaid", type: "uint256" },
          { name: "withdrawn", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getContributions",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "lender", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type LoanStatus = "Pending" | "Funded" | "Repaid" | "Expired";

export interface UiContribution {
  lender: string;
  amount: number; // ether
}

export interface UiLoan {
  id: string;
  borrower: string;
  borrowerAddress: string;
  amount: number;
  interestRate: number;
  deadline: number; // ms
  funded: number;
  repaid: number;
  totalDue: number;
  withdrawn: boolean;
  status: LoanStatus;
  contributions: UiContribution[];
  myContribution: number;
  myClaimed: number;
  myClaimable: number;
}
