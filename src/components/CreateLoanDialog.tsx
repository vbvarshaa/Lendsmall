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
import { Plus, Wallet } from "lucide-react";
import { shortAddress } from "@/hooks/use-wallet";

interface Props {
  address: string | null;
  onConnect: () => void;
  onCreate: (
    borrower: string,
    amount: number,
    interestRate: number,
    deadline: number,
  ) => Promise<void> | void;
}

export function CreateLoanDialog({ address, onConnect, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [borrower, setBorrower] = useState("");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("5");
  const [days, setDays] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  if (!address) {
    return (
      <Button size="lg" onClick={onConnect} className="gap-2 shadow-[var(--shadow-glow)]">
        <Wallet className="h-4 w-4" />
        Connect to create
      </Button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = borrower.trim();
    const amt = Number(amount);
    const rate = Number(interest);
    const dur = Number(days);
    if (!trimmed) return setError("Borrower name is required");
    if (trimmed.length > 60) return setError("Name too long");
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a valid amount");
    if (amt > 1_000_000) return setError("Amount too large");
    if (!Number.isFinite(rate) || rate < 0 || rate > 100)
      return setError("Interest must be between 0 and 100");
    if (!Number.isFinite(dur) || dur < 1 || dur > 3650)
      return setError("Duration must be 1–3650 days");
    const deadline = Date.now() + dur * 24 * 60 * 60 * 1000;
    setSigning(true);
    try {
      await onCreate(trimmed, amt, rate, deadline);
      setBorrower("");
      setAmount("");
      setInterest("5");
      setDays("30");
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
        <Button size="lg" className="gap-2 shadow-[var(--shadow-glow)]">
          <Plus className="h-4 w-4" />
          Create Loan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New loan request</DialogTitle>
          <DialogDescription>
            Signed by <span className="font-mono">{shortAddress(address)}</span> via MetaMask.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="borrower">Borrower display name</Label>
            <Input
              id="borrower"
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
              placeholder="e.g. Ana García"
              maxLength={60}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Loan amount (Ξ)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="interest">Interest rate (%)</Label>
              <Input
                id="interest"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Deadline (days)</Label>
              <Input
                id="days"
                type="number"
                step="1"
                min="1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
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
