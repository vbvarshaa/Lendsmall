// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MicroLend — beginner-friendly on-chain micro-lending
/// @notice Loans are created, funded, withdrawn, repaid and claimed on-chain.
///         All ETH movement is real and visible in MetaMask Activity / Etherscan.
contract MicroLend {
    struct Contribution {
        address lender;
        uint256 amount;
    }

    struct Loan {
        address borrower;
        string  name;          // human-readable display name
        uint256 amount;        // principal in wei
        uint256 interestRate;  // whole-percent (e.g. 5 = 5%)
        uint256 deadline;      // unix seconds
        uint256 funded;        // total wei contributed
        uint256 repaid;        // total wei repaid
        bool    withdrawn;     // borrower withdrew principal
    }

    Loan[] private _loans;
    mapping(uint256 => Contribution[]) private _contributions;
    mapping(uint256 => mapping(address => uint256)) public claimed; // wei already claimed by lender

    event LoanCreated(
        uint256 indexed id,
        address indexed borrower,
        string  name,
        uint256 amount,
        uint256 interestRate,
        uint256 deadline
    );
    event LoanFunded(uint256 indexed id, address indexed lender, uint256 amount, uint256 totalFunded);
    event LoanWithdrawn(uint256 indexed id, address indexed borrower, uint256 amount);
    event LoanRepaid(uint256 indexed id, address indexed payer, uint256 amount, uint256 totalRepaid);
    event RepaymentClaimed(uint256 indexed id, address indexed lender, uint256 amount);

    function createLoan(
        string calldata name,
        uint256 amount,
        uint256 interestRate,
        uint256 deadline
    ) external returns (uint256 id) {
        require(amount > 0, "amount=0");
        require(interestRate <= 100, "interest>100");
        require(deadline > block.timestamp, "deadline in past");
        require(bytes(name).length > 0 && bytes(name).length <= 60, "bad name");

        _loans.push(Loan({
            borrower: msg.sender,
            name: name,
            amount: amount,
            interestRate: interestRate,
            deadline: deadline,
            funded: 0,
            repaid: 0,
            withdrawn: false
        }));
        id = _loans.length - 1;
        emit LoanCreated(id, msg.sender, name, amount, interestRate, deadline);
    }

    function fundLoan(uint256 id) external payable {
        require(id < _loans.length, "no loan");
        Loan storage l = _loans[id];
        require(msg.value > 0, "value=0");
        require(l.funded < l.amount, "already funded");
        require(block.timestamp <= l.deadline, "expired");

        uint256 take = msg.value;
        uint256 remaining = l.amount - l.funded;
        if (take > remaining) {
            uint256 refund = take - remaining;
            take = remaining;
            (bool refunded, ) = msg.sender.call{value: refund}("");
            require(refunded, "refund failed");
        }
        l.funded += take;
        _contributions[id].push(Contribution(msg.sender, take));
        emit LoanFunded(id, msg.sender, take, l.funded);
    }

    function withdraw(uint256 id) external {
        require(id < _loans.length, "no loan");
        Loan storage l = _loans[id];
        require(msg.sender == l.borrower, "not borrower");
        require(l.funded >= l.amount, "not fully funded");
        require(!l.withdrawn, "already withdrawn");
        l.withdrawn = true;
        (bool ok, ) = msg.sender.call{value: l.amount}("");
        require(ok, "transfer failed");
        emit LoanWithdrawn(id, msg.sender, l.amount);
    }

    function totalDue(uint256 id) public view returns (uint256) {
        Loan storage l = _loans[id];
        return l.amount + (l.amount * l.interestRate) / 100;
    }

    function repayLoan(uint256 id) external payable {
        require(id < _loans.length, "no loan");
        Loan storage l = _loans[id];
        require(msg.value > 0, "value=0");
        l.repaid += msg.value;
        emit LoanRepaid(id, msg.sender, msg.value, l.repaid);
    }

    /// @notice Lender claims their pro-rata share of repayments so far.
    function claimRepayment(uint256 id) external {
        require(id < _loans.length, "no loan");
        Loan storage l = _loans[id];
        require(l.amount > 0, "bad loan");

        uint256 myContribution = 0;
        Contribution[] storage cs = _contributions[id];
        for (uint256 i = 0; i < cs.length; i++) {
            if (cs[i].lender == msg.sender) myContribution += cs[i].amount;
        }
        require(myContribution > 0, "not a lender");

        uint256 due = totalDue(id);
        uint256 entitled = (l.repaid * myContribution) / l.amount;
        uint256 cap = (due * myContribution) / l.amount;
        if (entitled > cap) entitled = cap;

        uint256 already = claimed[id][msg.sender];
        require(entitled > already, "nothing to claim");
        uint256 payout = entitled - already;
        claimed[id][msg.sender] = entitled;

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");
        emit RepaymentClaimed(id, msg.sender, payout);
    }

    // --- views --------------------------------------------------------

    function loanCount() external view returns (uint256) {
        return _loans.length;
    }

    function getLoan(uint256 id) external view returns (Loan memory) {
        return _loans[id];
    }

    function getContributions(uint256 id) external view returns (Contribution[] memory) {
        return _contributions[id];
    }
}
