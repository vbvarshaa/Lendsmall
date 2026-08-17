const hre = require("hardhat");

async function main() {
  const Loan = await hre.ethers.getContractFactory("MicroLend");

  const loan = await Loan.deploy();

  await loan.deployed();

  console.log("Contract deployed to:", loan.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});