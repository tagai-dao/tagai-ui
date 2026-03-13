export const abis = {
    "IPShare1": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "createFee",
            "type": "uint256"
          }
        ],
        "name": "CreateIPshare",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "staker",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "bool",
            "name": "isStake",
            "type": "bool"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "stakedAmount",
            "type": "uint256"
          }
        ],
        "name": "Stake",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "trader",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "bool",
            "name": "isBuy",
            "type": "bool"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "shareAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "ethAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "protocolEthAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "subjectEthAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          }
        ],
        "name": "Trade",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "investor",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "ValueCaptured",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "buyer",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          }
        ],
        "name": "buyShares",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "createFee",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "createShare",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "donutFeePercent",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethAmount",
            "type": "uint256"
          }
        ],
        "name": "getBuyAmountByValue",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPrice",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "getMaxStaker",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "staker",
            "type": "address"
          }
        ],
        "name": "getPendingProfits",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "staker",
            "type": "address"
          }
        ],
        "name": "getStakerInfo",
        "outputs": [
          {
            "components": [
              {
                "internalType": "address",
                "name": "staker",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "redeemAmount",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "unlockTime",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "debts",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "profit",
                "type": "uint256"
              }
            ],
            "internalType": "struct IPShare.Staker",
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
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "ipshareBalance",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "ipshareCreated",
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
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "ipshareSupply",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "redeem",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "shareAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          }
        ],
        "name": "sellShares",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "stake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "subjectFeePercent",
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
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "totalStakedIPshare",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "unstake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "valueCapture",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "IPShare2": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "createFee",
            "type": "uint256"
          }
        ],
        "name": "CreateIPshare",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "buyer",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          }
        ],
        "name": "buyShares",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "createFee",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "createShare",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethAmount",
            "type": "uint256"
          }
        ],
        "name": "getBuyAmountByValue",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPrice",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "getMaxStaker",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "staker",
            "type": "address"
          }
        ],
        "name": "getPendingProfits",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "staker",
            "type": "address"
          }
        ],
        "name": "getStakerInfo",
        "outputs": [
          {
            "components": [
              {
                "internalType": "address",
                "name": "staker",
                "type": "address"
              },
              {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "redeemAmount",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "unlockTime",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "debts",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "profit",
                "type": "uint256"
              }
            ],
            "internalType": "struct IPShare.Staker",
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
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "holder",
            "type": "address"
          }
        ],
        "name": "ipshareBalance",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "ipshareCreated",
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
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "ipshareSupply",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "redeem",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "shareAmount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          }
        ],
        "name": "sellShares",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "stake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "totalStakedIPshare",
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
            "internalType": "address",
            "name": "subject",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "unstake",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "subject",
            "type": "address"
          }
        ],
        "name": "valueCapture",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "WrapSwaper": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "_ipshare",
            "type": "address"
          }
        ],
        "name": "buyToken",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "_ipshare",
            "type": "address"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
    ],
    "WrapSwaper2": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "uniswapRouter02",
            "type": "address"
          }
        ],
        "name": "buyToken",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "uniswapRouterv3",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "poolFee",
            "type": "uint24"
          }
        ],
        "name": "buyTokenV3",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "feeAddress",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "uniswapRouter02",
            "type": "address"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "uniswapRouterv3",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "poolFee",
            "type": "uint24"
          }
        ],
        "name": "sellTokenV3",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    "Pump1": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "tick",
            "type": "string"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "creator",
            "type": "address"
          }
        ],
        "name": "NewToken",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          }
        ],
        "name": "claimPendingSocialRewards",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "tick",
            "type": "string"
          }
        ],
        "name": "createToken",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "createdTicks",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "bondingCurveSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethAmount",
            "type": "uint256"
          }
        ],
        "name": "getBuyAmountByValue",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
        "name": "getClaimFee",
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
        "name": "getFeeRatio",
        "outputs": [
          {
            "internalType": "uint256[2]",
            "name": "",
            "type": "uint256[2]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Pump2": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "tick",
            "type": "string"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "creator",
            "type": "address"
          }
        ],
        "name": "NewToken",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimedOrder",
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
        "inputs": [
          {
            "internalType": "string",
            "name": "tick",
            "type": "string"
          }
        ],
        "name": "createToken",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "createdTicks",
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
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "createdTokens",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Pump3": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "tick",
            "type": "string"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "creator",
            "type": "address"
          }
        ],
        "name": "NewToken",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimedOrder",
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
        "inputs": [
          {
            "internalType": "string",
            "name": "tick",
            "type": "string"
          }
        ],
        "name": "createToken",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "createdTicks",
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
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "createdTokens",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Pump4": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "tick",
            "type": "string"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "creator",
            "type": "address"
          }
        ],
        "name": "NewToken",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimedOrder",
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
        "inputs": [
          {
            "internalType": "string",
            "name": "tick",
            "type": "string"
          }
        ],
        "name": "createToken",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "createdTicks",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "bondingCurveSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethAmount",
            "type": "uint256"
          }
        ],
        "name": "getBuyAmountByValue",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "createdTokens",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Pump5": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "string",
            "name": "tick",
            "type": "string"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "creator",
            "type": "address"
          }
        ],
        "name": "NewToken",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "getTradeSigner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimedOrder",
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
        "inputs": [
          {
            "internalType": "string",
            "name": "tick",
            "type": "string"
          }
        ],
        "name": "createToken",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "createdTicks",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "bondingCurveSupply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ethAmount",
            "type": "uint256"
          }
        ],
        "name": "getBuyAmountByValue",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "createdTokens",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBuyPriceAfterFee",
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
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPrice",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "supply",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getSellPriceAfterFee",
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
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Pump6": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      }
    ],
    "Token1": [
      {
        "inputs": [],
        "name": "bondingCurveSupply",
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
        "name": "bondingCurveSupply",
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
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
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
            "name": "expectAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          },
          {
            "internalType": "address",
            "name": "receiver",
            "type": "address"
          }
        ],
        "name": "buyToken",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "listed",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expectReceive",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Token2": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "expectAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "buyToken",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "listed",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expectReceive",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "from",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transferFrom",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Token3": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "expectAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "buyToken",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expectReceive",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "from",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transferFrom",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Token4": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "expectAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "buyToken",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expectReceive",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "Token5": [
      {
        "inputs": [],
        "name": "bondingCurveSupply",
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
        "name": "bondingCurveSupply",
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
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "owner",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "result",
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
            "name": "expectAmount",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "buyToken",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "listed",
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
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "expectReceive",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          }
        ],
        "name": "sellToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "UniswapFactory": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "getPair",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    "UniswapRouter": [
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountOut",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          }
        ],
        "name": "getAmountsIn",
        "outputs": [
          {
            "internalType": "uint256[]",
            "name": "amounts",
            "type": "uint256[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          }
        ],
        "name": "getAmountsOut",
        "outputs": [
          {
            "internalType": "uint256[]",
            "name": "amounts",
            "type": "uint256[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          }
        ],
        "name": "swapExactTokensForETH",
        "outputs": [
          {
            "internalType": "uint256[]",
            "name": "amounts",
            "type": "uint256[]"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          }
        ],
        "name": "swapExactETHForTokens",
        "outputs": [
          {
            "internalType": "uint256[]",
            "name": "amounts",
            "type": "uint256[]"
          }
        ],
        "stateMutability": "payable",
        "type": "function"
      }
    ],
    "UniswapV3Pool": [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    ],
    "errors": [
      {
        "type": "error",
        "name": "OnlyHumanAllowed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "IllegalRatios",
        "inputs": []
      },
      {
        "type": "error",
        "name": "GameIsNotStarted",
        "inputs": []
      },
      {
        "type": "error",
        "name": "IPShareNotExist",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidCurrency",
        "inputs": []
      },
      {
        "type": "error",
        "name": "DonutNotSet",
        "inputs": []
      },
      {
        "type": "error",
        "name": "PendingTradeNow",
        "inputs": []
      },
      {
        "type": "error",
        "name": "OnlyDonut",
        "inputs": []
      },
      {
        "type": "error",
        "name": "OnlyStaker",
        "inputs": []
      },
      {
        "type": "error",
        "name": "FeePercentIsTooLarge",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TooMuchFee",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CanntPauseNow",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CanntUnpauseNow",
        "inputs": []
      },
      {
        "type": "error",
        "name": "IPShareAlreadyCreated",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InsufficientPay",
        "inputs": []
      },
      {
        "type": "error",
        "name": "RefundFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "PayCreateFeeFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "IPShareNotExist",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CostTradeFeeFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CanntSellLast10Shares",
        "inputs": []
      },
      {
        "type": "error",
        "name": "UnableToSendFunds",
        "inputs": []
      },
      {
        "type": "error",
        "name": "NoFunds",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InsufficientShares",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InUnstakingPeriodNow",
        "inputs": []
      },
      {
        "type": "error",
        "name": "WrongAmountOrInsufficientStakeAmount",
        "inputs": []
      },
      {
        "type": "error",
        "name": "NoIPShareToRedeem",
        "inputs": []
      },
      {
        "type": "error",
        "name": "IPShareIsInlockingPeriodNow",
        "inputs": []
      },
      {
        "type": "error",
        "name": "NoProfitToClaim",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TickHasBeenCreated",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CantBeZeroAddress",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CantSetSocialDistributionMoreThanTotalSupply",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TooMuchFee",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InsufficientCreateFee",
        "inputs": []
      },
      {
        "type": "error",
        "name": "PreMineTokenFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "RefundFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TokenNotListed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TokenListed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "IPShareNotCreated",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TokenInitialized",
        "inputs": []
      },
      {
        "type": "error",
        "name": "ClaimOrderExist",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidSignature",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidClaimAmount",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidClaimer",
        "inputs": []
      },
      {
        "type": "error",
        "name": "OutOfSlippage",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CreateDexPoolFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InsufficientFund",
        "inputs": []
      },
      {
        "type": "error",
        "name": "RefundFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CostFeeFail",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CanntSellLockedToken",
        "inputs": []
      },
      {
        "type": "error",
        "name": "ExceedsPerLimit",
        "inputs": []
      },
      {
        "type": "error",
        "name": "ExceedsDailyLimit",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidToXId",
        "inputs": []
      },
      {
        "type": "error",
        "name": "AlreadyWithdraw",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TransferFailed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "TransferFromFailed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "BuyTokenFailed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidPath",
        "inputs": []
      },
      {
        "type": "error",
        "name": "CostFeeFailed",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InvalidAddress",
        "inputs": []
      },
      {
        "type": "error",
        "name": "InsufficientFee",
        "inputs": []
      },
    ],
     "CoinPurse": [
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "withdrawBNB",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "alreadyWithdraw",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountOutMin",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "path",
            "type": "address[]"
          },
          {
            "internalType": "uint256",
            "name": "deadline",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "router",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          }
        ],
        "name": "externalSwap",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amountIn",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "tokenOut",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "sellsman",
            "type": "address"
          },
          {
            "internalType": "uint16",
            "name": "slippage",
            "type": "uint16"
          },
          {
            "internalType": "uint16",
            "name": "version",
            "type": "uint16"
          }
        ],
        "name": "internalSwap",
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
            "name": "maxPerTx",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "maxPerDay",
            "type": "uint256"
          }
        ],
        "name": "setLimit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "xId",
            "type": "uint256"
          },
          {
            "internalType": "address[]",
            "name": "tokens",
            "type": "address[]"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "stateMutability": "payable",
        "type": "receive"
      }
    ],
    "WETH": [
      {
        "constant": false,
        "inputs": [],
        "name": "deposit",
        "outputs": [],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "wad",
            "type": "uint256"
          }
        ],
        "name": "withdraw",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    "ERC20": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "totalSupply",
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
            "internalType": "address",
            "name": "account",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    "PopUp": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "token",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "orderId",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "bytes",
            "name": "signature",
            "type": "bytes"
          }
        ],
        "name": "userClaim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      }
    ],
    "FPMMDeterministicFactory": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "creator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "fixedProductMarketMaker",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "conditionalTokens",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "collateralToken",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "conditionIds",
            "type": "bytes32[]"
          },
          {
            "indexed": false,
            "name": "fee",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "maxFee",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "endTime",
            "type": "uint256"
          }
        ],
        "name": "FixedProductMarketMakerCreation",
        "type": "event"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "collateralToken",
            "type": "address"
          },
          {
            "name": "questionId",
            "type": "bytes32"
          },
          {
            "name": "distributionHint",
            "type": "uint256[]"
          },
          {
            "name": "feeCheckPath",
            "type": "address[]"
          },
          {
            "name": "uintParams",
            "type": "uint256[]"
          }
        ],
        "name": "create2FixedProductMarketMakerWithCondition",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],

    "FPMMDeterministicFactory2": [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "creator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "fixedProductMarketMaker",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "conditionalTokens",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "collateralToken",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "conditionIds",
            "type": "bytes32[]"
          },
          {
            "indexed": false,
            "name": "fee",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "maxFee",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "endTime",
            "type": "uint256"
          }
        ],
        "name": "FixedProductMarketMakerCreation",
        "type": "event"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "collateralToken",
            "type": "address"
          },
          {
            "name": "questionId",
            "type": "bytes32"
          },
          {
            "name": "distributionHint",
            "type": "uint256[]"
          },
          {
            "name": "feeCheckPath",
            "type": "address[]"
          },
          {
            "name": "uintParams",
            "type": "uint256[]"
          }
        ],
        "name": "create2FixedProductMarketMakerWithCondition",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    "FixedProductMarketMaker": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "account",
            "type": "address"
          }
        ],
        "name": "withdrawFees",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "getBNBFee",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "investmentAmount",
            "type": "uint256"
          },
          {
            "name": "outcomeIndex",
            "type": "uint256"
          },
          {
            "name": "minOutcomeTokensToBuy",
            "type": "uint256"
          }
        ],
        "name": "buy",
        "outputs": [],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "returnAmount",
            "type": "uint256"
          },
          {
            "name": "outcomeIndex",
            "type": "uint256"
          }
        ],
        "name": "calcSellAmount",
        "outputs": [
          {
            "name": "outcomeTokenSellAmount",
            "type": "uint256"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getFee",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "returnAmount",
            "type": "uint256"
          },
          {
            "name": "outcomeIndex",
            "type": "uint256"
          },
          {
            "name": "maxOutcomeTokensToSell",
            "type": "uint256"
          }
        ],
        "name": "sell",
        "outputs": [],
        "payable": true,
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "addedFunds",
            "type": "uint256"
          },
          {
            "name": "distributionHint",
            "type": "uint256[]"
          }
        ],
        "name": "addFunding",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "sharesToBurn",
            "type": "uint256"
          }
        ],
        "name": "removeFunding",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "investmentAmount",
            "type": "uint256"
          },
          {
            "name": "outcomeIndex",
            "type": "uint256"
          }
        ],
        "name": "calcBuyAmount",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
    ],
    "ConditionalTokens": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "collateralToken",
            "type": "address"
          },
          {
            "name": "parentCollectionId",
            "type": "bytes32"
          },
          {
            "name": "conditionId",
            "type": "bytes32"
          },
          {
            "name": "indexSets",
            "type": "uint256[]"
          }
        ],
        "name": "redeemPositions",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "collateralToken",
            "type": "address"
          },
          {
            "name": "collectionId",
            "type": "bytes32"
          }
        ],
        "name": "getPositionId",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "owners",
            "type": "address[]"
          },
          {
            "name": "ids",
            "type": "uint256[]"
          }
        ],
        "name": "balanceOfBatch",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "oracle",
            "type": "address"
          },
          {
            "name": "questionId",
            "type": "bytes32"
          },
          {
            "name": "outcomeSlotCount",
            "type": "uint256"
          }
        ],
        "name": "getConditionId",
        "outputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "payable": false,
        "stateMutability": "pure",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "parentCollectionId",
            "type": "bytes32"
          },
          {
            "name": "conditionId",
            "type": "bytes32"
          },
          {
            "name": "indexSet",
            "type": "uint256"
          }
        ],
        "name": "getCollectionId",
        "outputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "owner",
            "type": "address"
          },
          {
            "name": "operator",
            "type": "address"
          }
        ],
        "name": "isApprovedForAll",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "operator",
            "type": "address"
          },
          {
            "name": "approved",
            "type": "bool"
          }
        ],
        "name": "setApprovalForAll",
        "outputs": [],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ],
    "Pump7": [
      {"inputs":[{"internalType":"string","name":"tick","type":"string"},{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"createToken","outputs":[],"stateMutability":"payable","type":"function"},
      {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"orderId","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes","name":"signature","type":"bytes"}],"name":"userClaim","outputs":[],"stateMutability":"payable","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"ethAmount","type":"uint256"}],"name":"getBuyAmountByValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getBuyPriceAfterFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getSellPriceAfterFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"totalClaimedSocialRewards","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[],"name":"getLastSaltIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"tick","type":"string"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"creator","type":"address"}],"name":"NewToken","type":"event"}
    ],
    "Token7": [
      {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"sellsman","type":"address"},{"internalType":"uint16","name":"slippage","type":"uint16"}],"name":"buyToken","outputs":[],"stateMutability":"payable","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"minReceive","type":"uint256"},{"internalType":"address","name":"sellsman","type":"address"},{"internalType":"uint16","name":"slippage","type":"uint16"}],"name":"sellToken","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[],"name":"bondingCurveSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[],"name":"listed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
      {"inputs":[],"name":"v4PoolId","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
      {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}
    ],
    "IPShare3": [
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"createShare","outputs":[],"stateMutability":"payable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"address","name":"buyer","type":"address"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"}],"name":"buyShares","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"payable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"uint256","name":"shareAmount","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"}],"name":"sellShares","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"ipshareCreated","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"ipshareSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"address","name":"holder","type":"address"}],"name":"ipshareBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"valueCapture","outputs":[],"stateMutability":"payable","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},
      {"inputs":[{"internalType":"uint256","name":"supply","type":"uint256"},{"internalType":"uint256","name":"ethAmount","type":"uint256"}],"name":"getBuyAmountByValue","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getBuyPriceAfterFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getSellPriceAfterFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"stake","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"unstake","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"redeem","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"address","name":"staker","type":"address"}],"name":"getStakerInfo","outputs":[{"components":[{"internalType":"address","name":"staker","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"redeemAmount","type":"uint256"},{"internalType":"uint256","name":"unlockTime","type":"uint256"},{"internalType":"uint256","name":"debts","type":"uint256"},{"internalType":"uint256","name":"profit","type":"uint256"}],"internalType":"struct IPShare.Staker","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"totalStakedIPshare","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"},{"internalType":"address","name":"staker","type":"address"}],"name":"getPendingProfits","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"getMaxStaker","outputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
      {"inputs":[{"internalType":"address","name":"subject","type":"address"}],"name":"keyFundRatio","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
    ],
    "Permit2": [
      {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"}],"name":"approve","outputs":[],"stateMutability":"nonpayable","type":"function"},
      {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint160","name":"amount","type":"uint160"},{"internalType":"uint48","name":"expiration","type":"uint48"},{"internalType":"uint48","name":"nonce","type":"uint48"}],"stateMutability":"view","type":"function"}
    ]
}