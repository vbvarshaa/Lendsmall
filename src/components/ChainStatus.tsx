import { Shield, ShieldAlert, ShieldCheck, Network, FileCode } from "lucide-react";

interface Props {
  isSepolia: boolean;
  chainId: number | null;
  contractAddress: string | null;
  loanCount: number;
  loading: boolean;
}

export function ChainStatus({
  isSepolia,
  chainId,
  contractAddress,
  loanCount,
  loading,
}: Props) {
  return (
    <div className="inline-flex flex-wrap items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs backdrop-blur">
      <div className="flex items-center gap-1.5">
        <Network className="h-3.5 w-3.5 text-primary" />
        {isSepolia ? (
          <span className="font-mono text-success">Sepolia</span>
        ) : (
          <span className="font-mono text-warning">
            {chainId == null ? "no network" : `chain ${chainId}`}
          </span>
        )}
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <FileCode className="h-3.5 w-3.5 text-primary" />
        {contractAddress ? (
          <span className="font-mono text-foreground" title={contractAddress}>
            {contractAddress.slice(0, 6)}…{contractAddress.slice(-4)}
          </span>
        ) : (
          <span className="font-mono text-muted-foreground">no contract</span>
        )}
      </div>
      <div className="h-3 w-px bg-border" />
      {!contractAddress || !isSepolia ? (
        <div className="flex items-center gap-1.5 text-warning">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="font-mono">not ready</span>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Shield className="h-3.5 w-3.5" />
          <span className="font-mono">loading…</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="font-mono">{loanCount} on-chain</span>
        </div>
      )}
    </div>
  );
}
