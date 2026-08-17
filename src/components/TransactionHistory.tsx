import { type TxRecord } from "@/hooks/use-microlend";
import { txExplorerUrl } from "@/lib/contract";
import { shortAddress } from "@/hooks/use-wallet";
import { ArrowUpRight, Coins, Plus, Wallet, Banknote, HandCoins } from "lucide-react";

interface Props {
  txHistory: TxRecord[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txIcon(kind: TxRecord["kind"]) {
  if (kind === "CREATE") return <Plus className="h-3.5 w-3.5" />;
  if (kind === "FUND") return <Wallet className="h-3.5 w-3.5" />;
  if (kind === "WITHDRAW") return <Banknote className="h-3.5 w-3.5" />;
  if (kind === "REPAY") return <Coins className="h-3.5 w-3.5" />;
  return <HandCoins className="h-3.5 w-3.5" />;
}

function shortHash(h: string) {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export function TransactionHistory({ txHistory }: Props) {
  if (txHistory.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent transactions</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {txHistory.length} signed from this browser
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur">
        <ul className="divide-y divide-border/60">
          {txHistory.map((rec) => (
            <li
              key={rec.hash}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex w-24 shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                {txIcon(rec.kind)}
                {rec.kind}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="truncate text-sm">{rec.detail ?? rec.kind}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  by {shortAddress(rec.signer)}
                  {rec.loanId !== undefined && <> · loan #{rec.loanId}</>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 font-mono text-[10px] text-muted-foreground">
                <a
                  href={txExplorerUrl(rec.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  title={rec.hash}
                >
                  {shortHash(rec.hash)}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
                <span>{formatTime(rec.timestamp)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
