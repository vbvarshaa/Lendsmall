import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, Wallet } from "lucide-react";
import { shortAddress } from "@/hooks/use-wallet";

interface Props {
  loanId: string;
  remaining: number;
  address: string | null;
  borrowerAddress: string;
  onConnect: () => void;
  onRepay: (amount: number) => Promise<void> | void;
}

export function RepayLoanDialog({
  loanId,
  remaining,
  address,
  borrowerAddress,
  onConnect,
  onRepay,
}: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  if (!address) {
    return (
      <Button variant="outline" onClick={onConnect} className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect to repay
      </Button>
    );
  }

  const isBorrower = address.toLowerCase() === borrowerAddress.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isBorrower)
      return setError(
        `Only the borrower (${shortAddress(borrowerAddress)}) can sign repayments.`,
      );
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a valid amount");
    if (amt > remaining + 0.0001) return setError(`Max remaining is ${remaining.toFixed(2)}`);
    setSigning(true);
    try {
      await onRepay(amt);
      setAmount("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signature rejected");
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Coins className="h-4 w-4" />
          Repay Loan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repay this loan</DialogTitle>
          <DialogDescription>
            Loan <span className="font-mono">#{loanId}</span> · {remaining.toFixed(2)} Ξ remaining
            (principal + interest)
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isBorrower && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              Connected as <span className="font-mono">{shortAddress(address)}</span>. Switch to{" "}
              <span className="font-mono">{shortAddress(borrowerAddress)}</span> in MetaMask to
              sign repayments.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="repayment">Repayment amount (Ξ)</Label>
            <Input
              id="repayment"
              type="number"
              step="any"
              min="0"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={remaining.toFixed(2)}
              autoFocus
              disabled={!isBorrower}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={signing || !isBorrower}>
              {signing ? "Awaiting signature…" : "Sign with MetaMask"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
