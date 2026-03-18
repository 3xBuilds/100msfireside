// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
/**
 * @title FirebaseAdFees
 * @dev Gas-optimized contract for transferring ETH and ERC-20 tokens to multiple recipients
 */
contract FirebaseAdFees is ReentrancyGuard, Pausable {
    // Packed fee configuration structure for gas optimization
    struct FeeConfig {
        address wallet1;          // 20 bytes
        address wallet2;          // 20 bytes
        uint96 wallet1Percentage; // 12 bytes - sufficient for basis points
        uint96 wallet2Percentage; // 12 bytes - sufficient for basis points
        uint64 totalFeePercentage;// 8 bytes - sufficient for basis points
    }
    // Current fee configuration
    FeeConfig public feeConfig;
    // Constants
    uint256 public constant MAX_RECIPIENTS = 200;
    uint256 public constant BASIS_POINTS = 10000;
    // Events
    event ETHDistributed(address indexed sender, uint256 totalAmount, uint256 recipientCount, uint256 totalFees);
    event TokenDistributed(address indexed sender, address indexed token, uint256 totalAmount, uint256 recipientCount, uint256 totalFees);
    // Custom errors
    error InvalidRecipientCount();
    error InvalidFeeConfiguration();
    error InvalidWalletAddress();
    error InsufficientBalance();
    error TransferFailed();
    error InvalidAmount();
    error NotAuthorized();
    error SameAddress();
    // Custom modifiers
    modifier onlyAdmin() {
        _checkAdmin();
        _;
    }
    modifier onlyWallet1() {
        _checkWallet1();
        _;
    }
    modifier onlyWallet2() {
        _checkWallet2();
        _;
    }
    constructor(
        address _wallet1,
        address _wallet2,
        uint96 _wallet1Percentage,
        uint96 _wallet2Percentage
    ) {
        _setFeeConfig(_wallet1, _wallet2, _wallet1Percentage, _wallet2Percentage);
    }
    /**
     * @dev Distribute ETH to multiple recipients with equal amounts
     */
    function distributeETH(address payable[] calldata recipients)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        uint256 recipientCount = recipients.length;
        if (recipientCount == 0 || recipientCount > MAX_RECIPIENTS) {
            revert InvalidRecipientCount();
        }
        uint256 msgValue = msg.value;
        if (msgValue == 0) {
            revert InvalidAmount();
        }
        FeeConfig memory config = feeConfig;
        uint256 totalFees;
        unchecked {
            totalFees = (msgValue * config.totalFeePercentage) / BASIS_POINTS;
        }
        uint256 remainingAmount = msgValue - totalFees;
        uint256 amountPerRecipient = remainingAmount / recipientCount;
        if (amountPerRecipient == 0) {
            revert InvalidAmount();
        }
        for (uint256 i; i < recipientCount;) {
            address recipient = recipients[i];
            assembly {
                let success := call(gas(), recipient, amountPerRecipient, 0, 0, 0, 0)
                if iszero(success) {
                    mstore(0x00, 0x90b8ec18) // TransferFailed() selector
                    revert(0x1c, 0x04)
                }
            }
            unchecked { ++i; }
        }
        _distributeFees(totalFees, config);
        emit ETHDistributed(msg.sender, msgValue, recipientCount, totalFees);
    }
    /**
     * @dev Distribute ERC-20 tokens to multiple recipients with equal amounts
     */
    function distributeToken(
        address token,
        address[] calldata recipients,
        uint256 totalAmount
    )
        external
        nonReentrant
        whenNotPaused
    {
        uint256 recipientCount = recipients.length;
        if (recipientCount == 0 || recipientCount > MAX_RECIPIENTS) {
            revert InvalidRecipientCount();
        }
        if (totalAmount == 0) {
            revert InvalidAmount();
        }
        _transferFromSender(token, totalAmount);
        FeeConfig memory config = feeConfig;
        uint256 totalFees;
        unchecked {
            totalFees = (totalAmount * config.totalFeePercentage) / BASIS_POINTS;
        }
        _distributeTokensToRecipients(token, totalAmount, recipients, recipientCount);
        emit TokenDistributed(msg.sender, token, totalAmount, recipientCount, totalFees);
    }
    function _transferFromSender(address token, uint256 amount) internal {
        bytes memory transferFromData = abi.encodeWithSelector(
            IERC20.transferFrom.selector,
            msg.sender,
            address(this),
            amount
        );
        (bool success, bytes memory returnData) = token.call(transferFromData);
        if (!success || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
            revert TransferFailed();
        }
    }
    function _distributeTokensToRecipients(
        address token,
        uint256 totalAmount,
        address[] calldata recipients,
        uint256 recipientCount
    ) internal {
        FeeConfig memory config = feeConfig;
        uint256 totalFees;
        unchecked {
            totalFees = (totalAmount * config.totalFeePercentage) / BASIS_POINTS;
        }
        uint256 remainingAmount = totalAmount - totalFees;
        uint256 amountPerRecipient = remainingAmount / recipientCount;
        if (amountPerRecipient == 0) {
            revert InvalidAmount();
        }
        bytes memory transferData = abi.encodeWithSelector(IERC20.transfer.selector, address(0), amountPerRecipient);
        for (uint256 i; i < recipientCount;) {
            address recipient = recipients[i];
            assembly {
                mstore(add(transferData, 0x24), recipient)
            }
            bool transferSuccess;
            bytes memory transferReturnData;
            (transferSuccess, transferReturnData) = token.call(transferData);
            if (!transferSuccess || (transferReturnData.length != 0 && !abi.decode(transferReturnData, (bool)))) {
                revert TransferFailed();
            }
            unchecked { ++i; }
        }
        _distributeTokenFees(token, totalFees, config);
    }
    function updateFeePercentages(
        uint96 _wallet1Percentage,
        uint96 _wallet2Percentage
    ) external onlyAdmin {
        FeeConfig memory config = feeConfig;
        _setFeeConfig(
            config.wallet1,
            config.wallet2,
            _wallet1Percentage,
            _wallet2Percentage
        );
    }
    function updateWallet1Address(address _newWallet1) external onlyWallet1 {
        if (_newWallet1 == address(0)) revert InvalidWalletAddress();
        FeeConfig memory config = feeConfig;
        if (_newWallet1 == config.wallet1) revert SameAddress();
        if (_newWallet1 == config.wallet2) revert InvalidWalletAddress();
        feeConfig.wallet1 = _newWallet1;
    }
    function updateWallet2Address(address _newWallet2) external onlyWallet2 {
        if (_newWallet2 == address(0)) revert InvalidWalletAddress();
        FeeConfig memory config = feeConfig;
        if (_newWallet2 == config.wallet2) revert SameAddress();
        if (_newWallet2 == config.wallet1) revert InvalidWalletAddress();
        feeConfig.wallet2 = _newWallet2;
    }
    function _setFeeConfig(
        address _wallet1,
        address _wallet2,
        uint96 _wallet1Percentage,
        uint96 _wallet2Percentage
    ) internal {
        if (_wallet1 == address(0) || _wallet2 == address(0)) revert InvalidWalletAddress();
        if (_wallet1 == _wallet2) revert InvalidWalletAddress();
        uint64 totalFee = uint64(_wallet1Percentage + _wallet2Percentage);
        feeConfig = FeeConfig({
            wallet1: _wallet1,
            wallet2: _wallet2,
            wallet1Percentage: _wallet1Percentage,
            wallet2Percentage: _wallet2Percentage,
            totalFeePercentage: totalFee
        });
    }
    function _distributeFees(uint256 totalFees, FeeConfig memory config) internal {
        if (totalFees == 0) return;
        uint256 wallet1Fee;
        unchecked {
            wallet1Fee = (totalFees * config.wallet1Percentage) / config.totalFeePercentage;
        }
        uint256 wallet2Fee = totalFees - wallet1Fee;
        if (wallet1Fee > 0) {
            assembly {
                let success := call(gas(), mload(config), wallet1Fee, 0, 0, 0, 0)
                if iszero(success) {
                    mstore(0x00, 0x90b8ec18)
                    revert(0x1c, 0x04)
                }
            }
        }
        if (wallet2Fee > 0) {
            assembly {
                let success := call(gas(), mload(add(config, 0x20)), wallet2Fee, 0, 0, 0, 0)
                if iszero(success) {
                    mstore(0x00, 0x90b8ec18)
                    revert(0x1c, 0x04)
                }
            }
        }
    }
    function _distributeTokenFees(address token, uint256 totalFees, FeeConfig memory config) internal {
        if (totalFees == 0) return;
        uint256 wallet1Fee;
        unchecked {
            wallet1Fee = (totalFees * config.wallet1Percentage) / config.totalFeePercentage;
        }
        uint256 wallet2Fee = totalFees - wallet1Fee;
        bytes memory transferData = abi.encodeWithSelector(IERC20.transfer.selector, address(0), 0);
        if (wallet1Fee > 0) {
            assembly {
                mstore(add(transferData, 0x24), mload(config))
                mstore(add(transferData, 0x44), wallet1Fee)
            }
            (bool success, bytes memory returnData) = token.call(transferData);
            if (!success || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
                revert TransferFailed();
            }
        }
        if (wallet2Fee > 0) {
            assembly {
                mstore(add(transferData, 0x24), mload(add(config, 0x20)))
                mstore(add(transferData, 0x44), wallet2Fee)
            }
            (bool success, bytes memory returnData) = token.call(transferData);
            if (!success || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
                revert TransferFailed();
            }
        }
    }
    function getFeeConfig() external view returns (FeeConfig memory) {
        return feeConfig;
    }
    function calculateDistribution(uint256 totalAmount, uint256 recipientCount)
        external
        view
        returns (
            uint256 amountPerRecipient,
            uint256 totalFees,
            uint256 wallet1Fee,
            uint256 wallet2Fee
        )
    {
        FeeConfig memory config = feeConfig;
        unchecked {
            totalFees = (totalAmount * config.totalFeePercentage) / BASIS_POINTS;
        }
        uint256 remainingAmount = totalAmount - totalFees;
        amountPerRecipient = remainingAmount / recipientCount;
        unchecked {
            wallet1Fee = (totalFees * config.wallet1Percentage) / config.totalFeePercentage;
        }
        wallet2Fee = totalFees - wallet1Fee;
    }
    function pause() external onlyAdmin {
        _pause();
    }
    function unpause() external onlyAdmin {
        _unpause();
    }
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyAdmin {
        if (recipient == address(0)) revert InvalidWalletAddress();
        if (token == address(0)) {
            assembly {
                let success := call(gas(), recipient, amount, 0, 0, 0, 0)
                if iszero(success) {
                    mstore(0x00, 0x90b8ec18)
                    revert(0x1c, 0x04)
                }
            }
        } else {
            bytes memory transferData = abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount);
            (bool success, bytes memory returnData) = token.call(transferData);
            if (!success || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
                revert TransferFailed();
            }
        }
    }
    function isAdmin(address account) external view returns (bool) {
        FeeConfig memory config = feeConfig;
        return account == config.wallet1 || account == config.wallet2;
    }
    function _checkAdmin() internal view {
        FeeConfig memory config = feeConfig;
        if (msg.sender != config.wallet1 && msg.sender != config.wallet2) {
            revert NotAuthorized();
        }
    }
    function _checkWallet1() internal view {
        if (msg.sender != feeConfig.wallet1) revert NotAuthorized();
    }
    function _checkWallet2() internal view {
        if (msg.sender != feeConfig.wallet2) revert NotAuthorized();
    }
    receive() external payable {}
}