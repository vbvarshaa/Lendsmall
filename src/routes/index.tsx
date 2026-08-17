import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useMicroLend } from "@/hooks/use-microlend";
import { CreateLoanDialog } from "@/components/CreateLoanDialog";
import { LoanCard } from "@/components/LoanCard";
import { ChainStatus } from "@/components/ChainStatus";
import { TransactionHistory } from "@/components/TransactionHistory";
import { WalletButton } from "@/components/WalletButton";
import { ContractConfig } from "@/components/ContractConfig";
import { Button } from "@/components/ui/button";
import { Coins, TrendingUp, Users, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "ChainLend — Sepolia Micro-Lending" },
      {
        name: "description",
        content:
          "Real on-chain micro-loans on the Ethereum Sepolia testnet. Create, fund, withdraw, repay and claim — every action is a real MetaMask transaction.",
      },
    ],
  }),
});

function Home() {
  const wallet = useWallet();
  const ml = useMicroLend(wallet.address);

  const stats = useMemo(() => {
    const totalRequested = ml.loans.reduce((s, l) => s + l.amount, 0);
    const totalFunded = ml.loans.reduce((s, l) => s + l.funded, 0);
    const contributors = new Set<string>();
    ml.loans.forEach((l) => l.contributions.forEach((c) => contributors.add(c.lender)));
    return {
      totalRequested,
      totalFunded,
      contributors: contributors.size,
      activeLoans: ml.loans.filter((l) => l.status === "Pending").length,
    };
  }, [ml.loans]);

  const requireWallet = async (): Promise<string | null> => {
    if (wallet.address) return wallet.address;
    return await wallet.connect();
  };

  const handleCreate = async (
    borrower: string,
    amount: number,
    interestRate: number,
    deadline: number,
  ) => {
    const addr = await requireWallet();
    if (!addr) throw new Error("Wallet required");
    if (!ml.isSepolia) await ml.switchToSepolia();
    await ml.createLoan(borrower, amount, interestRate, deadline);
  };

  const handleFund = async (loanId: string, amount: number) => {
    const addr = await requireWallet();
    if (!addr) throw new Error("Wallet required");
    if (!ml.isSepolia) await ml.switchToSepolia();
    await ml.fundLoan(loanId, amount);
  };

  const handleRepay = async (loanId: string, amount: number) => {
    const addr = await requireWallet();
    if (!addr) throw new Error("Wallet required");
    if (!ml.isSepolia) await ml.switchToSepolia();
    await ml.repayLoan(loanId, amount);
  };

  const notReady = !ml.contractAddress || !ml.isSepolia;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12 md:py-16">
      <div className="mb-8 flex flex-wrap items-center justify-end gap-2">
        <ContractConfig
          contractAddress={ml.contractAddress}
          isSepolia={ml.isSepolia}
          chainId={ml.chainId}
          onSave={ml.setContractAddress}
          onSwitchNetwork={ml.switchToSepolia}
        />
        <WalletButton wallet={wallet} />
      </div>

      <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">
            <span className="h-px w-8 bg-primary" />
            sepolia · on-chain micro-lending
          </div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Lend small.{" "}
            <span className="bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              On real chain.
            </span>
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Every Create, Fund, Withdraw, Repay and Claim is a real Sepolia transaction signed in
            MetaMask — visible in your wallet's Activity tab and on Etherscan.
          </p>
          <ChainStatus
            isSepolia={ml.isSepolia}
            chainId={ml.chainId}
            contractAddress={ml.contractAddress}
            loanCount={ml.loans.length}
            loading={ml.loading}
          />
        </div>
        <CreateLoanDialog
          address={wallet.address}
          onConnect={() => void wallet.connect()}
          onCreate={handleCreate}
        />
      </header>

      {notReady && (
        <div className="mb-8 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <div className="mb-2 flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Setup needed</span>
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {!wallet.address && <li>· Connect MetaMask using the button in the top right.</li>}
            {wallet.address && !ml.isSepolia && (
              <li className="flex flex-wrap items-center gap-2">
                · You're not on Sepolia.
                <Button size="sm" variant="outline" onClick={() => void ml.switchToSepolia()}>
                  Switch to Sepolia
                </Button>
              </li>
            )}
            {!ml.contractAddress && (
              <li>
                · Deploy <span className="font-mono">contracts/MicroLend.sol</span> (see{" "}
                <span className="font-mono">DEPLOYMENT.md</span>) and paste the address into{" "}
                <span className="font-mono">Configure contract</span> in the header.
              </li>
            )}
          </ul>
          {ml.error && (
            <p className="mt-3 font-mono text-xs text-destructive">{ml.error}</p>
          )}
        </div>
      )}

      <section className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Total requested"
          value={`${stats.totalRequested.toFixed(4)} Ξ`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total funded"
          value={`${stats.totalFunded.toFixed(4)} Ξ`}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Contributors"
          value={stats.contributors.toString()}
        />
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Open loans"
          value={stats.activeLoans.toString()}
        />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Loan requests</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {ml.loans.length} on-chain
          </span>
        </div>

        {ml.loans.length === 0 ? (
          <EmptyState ready={!notReady} />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {ml.loans.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                address={wallet.address}
                onConnect={() => void wallet.connect()}
                onFund={handleFund}
                onRepay={handleRepay}
                onWithdraw={async (id) => {
                  await ml.withdraw(id);
                }}
                onClaim={async (id) => {
                  await ml.claimRepayment(id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <TransactionHistory txHistory={ml.txHistory} />

      <footer className="mt-16 border-t border-border/60 pt-6 text-center font-mono text-xs text-muted-foreground">
        Sepolia · MicroLend.sol · viem + MetaMask
      </footer>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function EmptyState({ ready }: { ready: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-card/30 p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Coins className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-base font-medium">No loans on the chain yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {ready
          ? "Create the first loan request — it will be a real Sepolia transaction."
          : "Finish the setup above, then create your first on-chain loan."}
      </p>
    </div>
  );
}
