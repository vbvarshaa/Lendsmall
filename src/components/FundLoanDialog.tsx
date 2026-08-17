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
import { Wallet } from "lucide-react";
import { shortAddress } from "@/hooks/use-wallet";

interface Props {
  loanId: string;
  remaining: number;
  address: string | null;
  onConnect: () => void;
  onFund: (amount: number) => Promise<void> | void;
}

export function FundLoanDialog({ loanId, remaining, address, onConnect, onFund }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  if (!address) {
    return (
      <Button variant="secondary" onClick={onConnect} className="gap-2">
        <Wallet className="h-4 w-4" />
        Connect to fund
      </Button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a valid amount");
    if (amt > remaining + 0.0001) return setError(`Max remaining is ${remaining.toFixed(2)}`);
    setSigning(true);
    try {
      await onFund(amt);
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
        <Button variant="secondary" className="gap-2">
          <Wallet className="h-4 w-4" />
          Fund Loan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fund this loan</DialogTitle>
          <DialogDescription>
            Loan <span className="font-mono">#{loanId}</span> · {remaining.toFixed(2)} Ξ remaining
            <br />
            From <span className="font-mono">{shortAddress(address)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contribution">Contribution (Ξ)</Label>
            <Input
              id="contribution"
              type="number"
              step="0.01"
              min="0"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={remaining.toFixed(2)}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={signing}>
              {signing ? "Awaiting signature…" : "Sign with MetaMask"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
