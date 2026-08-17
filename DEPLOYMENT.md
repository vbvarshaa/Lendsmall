# Deploying MicroLend to Sepolia

The `contracts/MicroLend.sol` contract powers this app. Until you deploy it
and paste the address into the app, the UI will tell you it's not configured.

## 1. Get Sepolia test ETH (free)

Open MetaMask, switch to **Sepolia** (Settings → "Show test networks" if hidden),
copy your address, and grab some test ETH from any of these faucets:

- https://sepoliafaucet.com
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://cloud.google.com/application/web3/faucet/ethereum/sepolia

You only need ~0.05 SEP ETH to deploy + play around.

## 2. Deploy with Remix (easiest, no install)

1. Go to https://remix.ethereum.org
2. In the **File explorer**, create a new file `MicroLend.sol` and paste the
   contents of `contracts/MicroLend.sol` from this repo.
3. Open the **Solidity Compiler** tab (left sidebar):
   - Compiler version: `0.8.20` or newer
   - Click **Compile MicroLend.sol**
4. Open the **Deploy & Run Transactions** tab:
   - Environment: **Injected Provider — MetaMask**
   - Make sure MetaMask is on **Sepolia**
   - Contract: `MicroLend`
   - Click **Deploy** → confirm in MetaMask
5. After it confirms, copy the deployed address from the
   **"Deployed Contracts"** section (looks like `0xabc…`).

## 3. Wire it into the app

1. Open the app and connect MetaMask (on Sepolia).
2. Click **Configure contract** in the header.
3. Paste the deployed address and save.

That's it — every Create / Fund / Withdraw / Repay / Claim is now a real
on-chain transaction. You'll see them in:

- MetaMask → **Activity** tab
- `https://sepolia.etherscan.io/address/<your-contract-address>`

## Notes

- Amounts are in **ETH** (sent as wei under the hood).
- `Withdraw` is how the borrower receives the principal once the loan is fully
  funded. `Claim repayment` is how each lender receives their pro-rata share
  after the borrower repays.
- The contract address is stored in `localStorage` per browser, so each user
  configures their own.
