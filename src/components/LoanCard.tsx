import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  HandCoins,
  ExternalLink,
} from "lucide-react";
import { type UiLoan, addressExplorerUrl } from "@/lib/contract";
import { shortAddress } from "@/hooks/use-wallet";
import { FundLoanDialog } from "./FundLoanDialog";
import { RepayLoanDialog } from "./RepayLoanDialog";
import { useState } from "react";

interface Props {
  loan: UiLoan;
  address: string | null;
  onConnect: () => void;
  onFund: (loanId: string, amount: number) => Promise<void> | void;
  onRepay: (loanId: string, amount: number) => Promise<void> | void;
  onWithdraw: (loanId: string) => Promise<void> | void;
  onClaim: (loanId: string) => Promise<void> | void;
}

function formatDeadline(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = ts - now;
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (diff < 0) return `${date} · expired`;
  if (days === 0) return `${date} · today`;
  return `${date} · ${days}d left`;
}

function StatusBadge({ status }: { status: UiLoan["status"] }) {
  if (status === "Funded")
    return (
      <Badge className="gap-1 bg-success text-success-foreground hover:bg-success">
        <CheckCircle2 className="h-3 w-3" />
        Funded
      </Badge>
    );
  if (status === "Repaid")
    return (
      <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary">
        <BadgeCheck className="h-3 w-3" />
        Repaid
      </Badge>
    );
  if (status === "Expired")
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
        <AlertTriangle className="h-3 w-3" />
        Expired
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

export function LoanCard({
  loan,
  address,
  onConnect,
  onFund,
  onRepay,
  onWithdraw,
  onClaim,
}: Props) {
  const pct = Math.min(100, (loan.funded / loan.amount) * 100);
  const remaining = Math.max(0, loan.amount - loan.funded);
  const repayRemaining = Math.max(0, loan.totalDue - loan.repaid);
  const repayPct = Math.min(100, (loan.repaid / Math.max(loan.totalDue, 1e-9)) * 100);
  const canFund = loan.status === "Pending";
  const canRepay = loan.status === "Funded" || (loan.repaid > 0 && loan.repaid < loan.totalDue);
  const isBorrower = !!address && address.toLowerCase() === loan.borrowerAddress;
  const canWithdraw = isBorrower && loan.funded >= loan.amount && !loan.withdrawn;
  const canClaim = !!address && loan.myClaimable > 1e-9;

  const [busy, setBusy] = useState<null | "withdraw" | "claim">(null);
  const run = async (kind: "withdraw" | "claim", fn: () => Promise<void> | void) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 bg-[var(--gradient-surface)] shadow-[var(--shadow-card)] transition hover:border-primary/40">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{loan.borrower}</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              {loan.amount.toFixed(4)} <span className="text-base text-muted-foreground">Ξ</span>
            </div>
            <div className="flex flex-wrap gap-x-3 font-mono text-xs text-muted-foreground">
              <span>loan #{loan.id}</span>
              <a
                href={addressExplorerUrl(loan.borrowerAddress)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary"
                title={loan.borrowerAddress}
              >
                by {shortAddress(loan.borrowerAddress)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <StatusBadge status={loan.status} />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            interest <span className="text-foreground">{loan.interestRate}%</span>
          </span>
          <span>
            due <span className="text-foreground">{loan.totalDue.toFixed(4)} Ξ</span>
          </span>
          <span>
            deadline <span className="text-foreground">{formatDeadline(loan.deadline)}</span>
          </span>
          {loan.withdrawn && <span className="text-success">principal withdrawn ✓</span>}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Funding
          </div>
          <Progress value={pct} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{loan.funded.toFixed(4)} Ξ</span> /{" "}
              {loan.amount.toFixed(4)} Ξ
            </span>
            <span>{pct.toFixed(0)}%</span>
          </div>
        </div>

        {(loan.status === "Funded" || loan.status === "Repaid" || loan.repaid > 0) && (
          <div className="space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Repayment
            </div>
            <Progress value={repayPct} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{loan.repaid.toFixed(4)} Ξ</span> /{" "}
                {loan.totalDue.toFixed(4)} Ξ
              </span>
              <span>{repayPct.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {address && loan.myContribution > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-2 font-mono text-[11px]">
            <span className="text-muted-foreground">your stake </span>
            <span className="text-foreground">{loan.myContribution.toFixed(4)} Ξ</span>
            {loan.myClaimed > 0 && (
              <>
                <span className="text-muted-foreground"> · claimed </span>
                <span className="text-foreground">{loan.myClaimed.toFixed(4)} Ξ</span>
              </>
            )}
            {loan.myClaimable > 1e-9 && (
              <>
                <span className="text-muted-foreground"> · claimable </span>
                <span className="text-success">{loan.myClaimable.toFixed(4)} Ξ</span>
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {loan.contributions.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Contributors ({loan.contributions.length})
              </div>
              <ul className="space-y-1.5">
                {loan.contributions.map((c, i) => (
                  <li
                    key={`${c.lender}-${i}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <a
                        href={addressExplorerUrl(c.lender)}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-xs hover:text-primary"
                        title={c.lender}
                      >
                        {shortAddress(c.lender)}
                      </a>
                    </div>
                    <span className="font-mono text-foreground">+{c.amount.toFixed(4)} Ξ</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          {canFund && (
            <FundLoanDialog
              loanId={loan.id}
              remaining={remaining}
              address={address}
              onConnect={onConnect}
              onFund={(amt) => onFund(loan.id, amt)}
            />
          )}
          {canWithdraw && (
            <Button
              variant="default"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => run("withdraw", () => onWithdraw(loan.id))}
            >
              <Banknote className="h-4 w-4" />
              {busy === "withdraw" ? "Confirming…" : `Withdraw ${loan.amount.toFixed(4)} Ξ`}
            </Button>
          )}
          {canRepay && (
            <RepayLoanDialog
              loanId={loan.id}
              remaining={repayRemaining}
              address={address}
              borrowerAddress={loan.borrowerAddress}
              onConnect={onConnect}
              onRepay={(amt) => onRepay(loan.id, amt)}
            />
          )}
          {canClaim && (
            <Button
              variant="secondary"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => run("claim", () => onClaim(loan.id))}
            >
              <HandCoins className="h-4 w-4" />
              {busy === "claim" ? "Confirming…" : `Claim ${loan.myClaimable.toFixed(4)} Ξ`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
