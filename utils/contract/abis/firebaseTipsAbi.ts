export const firebaseTipsAbi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_wallet1",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_wallet2",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_wallet1Percentage",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_wallet2Percentage",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "InsufficientBalance",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidAmount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidFeeConfiguration",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidRecipientCount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidWalletAddress",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NotAuthorized",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "SameAddress",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TransferFailed",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "oldWallet",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newWallet",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isWallet1",
				"type": "bool"
			}
		],
		"name": "AdminWalletUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address payable[]",
				"name": "recipients",
				"type": "address[]"
			}
		],
		"name": "distributeETH",
		"outputs": [],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address[]",
				"name": "recipients",
				"type": "address[]"
			},
			{
				"internalType": "uint256",
				"name": "totalAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "deadline",
				"type": "uint256"
			},
			{
				"internalType": "uint8",
				"name": "v",
				"type": "uint8"
			},
			{
				"internalType": "bytes32",
				"name": "r",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "s",
				"type": "bytes32"
			}
		],
		"name": "distributeTokenWithPermit",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			}
		],
		"name": "emergencyWithdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalAmount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "recipientCount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountPerRecipient",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalFees",
				"type": "uint256"
			}
		],
		"name": "ETHDistributed",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "wallet1",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "wallet2",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "wallet1Percentage",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "wallet2Percentage",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalFeePercentage",
				"type": "uint256"
			}
		],
		"name": "FeeConfigUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "wallet",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isETH",
				"type": "bool"
			}
		],
		"name": "FeesCollected",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "pause",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "Paused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalAmount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "recipientCount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountPerRecipient",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "totalFees",
				"type": "uint256"
			}
		],
		"name": "TokenDistributed",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "unpause",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "Unpaused",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_wallet1Percentage",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_wallet2Percentage",
				"type": "uint256"
			}
		],
		"name": "updateFeePercentages",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newWallet1",
				"type": "address"
			}
		],
		"name": "updateWallet1Address",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_newWallet2",
				"type": "address"
			}
		],
		"name": "updateWallet2Address",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [],
		"name": "BASIS_POINTS",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "totalAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "recipientCount",
				"type": "uint256"
			}
		],
		"name": "calculateDistribution",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "amountPerRecipient",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalFees",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "wallet1Fee",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "wallet2Fee",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "feeConfig",
		"outputs": [
			{
				"internalType": "address",
				"name": "wallet1",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "wallet2",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "wallet1Percentage",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "wallet2Percentage",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "totalFeePercentage",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getFeeConfig",
		"outputs": [
			{
				"components": [
					{
						"internalType": "address",
						"name": "wallet1",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "wallet2",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "wallet1Percentage",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "wallet2Percentage",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "totalFeePercentage",
						"type": "uint256"
					}
				],
				"internalType": "struct FiresideTips.FeeConfig",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "isAdmin",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "MAX_RECIPIENTS",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "paused",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]