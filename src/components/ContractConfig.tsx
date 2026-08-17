import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, ExternalLink } from "lucide-react";
import { addressExplorerUrl } from "@/lib/contract";

interface Props {
  contractAddress: string | null;
  isSepolia: boolean;
  chainId: number | null;
  onSave: (addr: string | null) => void;
  onSwitchNetwork: () => Promise<void> | void;
}

export function ContractConfig({
  contractAddress,
  isSepolia,
  chainId,
  onSave,
  onSwitchNetwork,
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(contractAddress ?? "");
  const [error, setError] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = value.trim();
    if (trimmed && !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError("Not a valid 0x… contract address");
      return;
    }
    onSave(trimmed || null);
    setOpen(false);
  };

  const label = contractAddress
    ? `${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}`
    : "Configure contract";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>MicroLend contract</DialogTitle>
          <DialogDescription>
            Paste the address of a deployed <span className="font-mono">MicroLend.sol</span> on
            Sepolia. See <span className="font-mono">DEPLOYMENT.md</span> for one-click Remix
            steps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Network</span>
            {isSepolia ? (
              <span className="font-mono text-success">Sepolia ✓</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={() => void onSwitchNetwork()}
              >
                {chainId == null ? "Connect" : `Switch from ${chainId} → Sepolia`}
              </Button>
            )}
          </div>
          {contractAddress && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Etherscan</span>
              <a
                href={addressExplorerUrl(contractAddress)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
              >
                view
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contract-address">Contract address</Label>
            <Input
              id="contract-address"
              placeholder="0x…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            {contractAddress && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onSave(null);
                  setValue("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            )}
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
