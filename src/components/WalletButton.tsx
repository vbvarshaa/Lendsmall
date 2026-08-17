import { Button } from "@/components/ui/button";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";
import { type WalletState, shortAddress } from "@/hooks/use-wallet";

interface Props {
  wallet: WalletState;
}

export function WalletButton({ wallet }: Props) {
  if (!wallet.hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/15"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Install MetaMask
      </a>
    );
  }

  if (!wallet.address) {
    return (
      <Button
        variant="outline"
        onClick={() => void wallet.connect()}
        disabled={wallet.isConnecting}
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        {wallet.isConnecting ? "Connecting…" : "Connect MetaMask"}
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 font-mono text-xs text-success-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      <span className="text-foreground">{shortAddress(wallet.address)}</span>
      <button
        onClick={wallet.disconnect}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Disconnect"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}
