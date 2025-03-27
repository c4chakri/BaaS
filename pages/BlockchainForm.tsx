import { log } from 'node:console';
import React, { use, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toWei, toHex } from 'web3-utils';
import { ethers } from 'ethers';
// import {toast} from 'toast';
interface BlockchainFormData {
  chainName: string;
  chainId: string; // Changed to string to match API
  qbftConfig: {
    genesis: {
      config: {
        chainId: number;
        berlinBlock: number;
        qbft: {
          blockperiodseconds: number;
          epochlength: number;
          requesttimeoutseconds: number;
        };
      };
      nonce: string;
      timestamp: string;
      gasLimit: string;
      difficulty: string;
      alloc: Record<string, { balance: string }>;
    };
    blockchain: {
      nodes: {
        generate: boolean;
        count: number;
      };
    };
  };
  features: {
    miningReward: boolean;
    validatorsChange: boolean;
    http: boolean;
    ws: boolean;
    metrics: boolean;
    corsOrigin: boolean;
  };
}

const BlockchainForm = () => {
  const { register, handleSubmit, watch, setValue } = useForm<BlockchainFormData>({
    defaultValues: {
      chainName: "",
      chainId: "",
      qbftConfig: {
        genesis: {
          config: {
            chainId: 235,
            berlinBlock: 0,
            qbft: {
              blockperiodseconds: 2,
              epochlength: 30000,
              requesttimeoutseconds: 4
            }
          },
          nonce: "0x0",
          timestamp: "0x58ee40ba",
          gasLimit: "0x989680",
          difficulty: "0x1",
          alloc: {

          }
        },
        blockchain: {
          nodes: {
            generate: true,
            count: 4
          }
        }
      },
      features: {
        miningReward: true,
        validatorsChange: true,
        http: true,
        ws: true,
        metrics: true,
        corsOrigin: true
      }
    }
  });



  const onSubmit = async (data: BlockchainFormData) => {
    try {
      // Log the payload for debugging
      console.log("API Payload:", data);
  
      // Make API call to create blockchain configuration
      const response = await fetch(
        'http://localhost:8000/api/blockchain/create', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data)
        }
      );
  
      // Check if the response is successful
      if (!response.ok) {
        // Parse error response
        const errorData = await response.json();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. 
           Details: ${JSON.stringify(errorData)}`
        );
      }
  
      // Parse successful response
      const result = await response.json();
      
      // Handle successful submission
      // toast.success('Blockchain created successfully', {
      //   description: result.message
      // });
  
      // Store network details for further use
      // setNetworkDetails({
      //   rpcUrl: result.networkRPC,
      //   chainId: result.chainId
      // });
  
      // Optional: Additional actions after successful creation
      // For example, you might want to:
      // - Update local storage
      // - Trigger a network refresh
      // - Navigate to a network details page
      console.log('Blockchain Network Details:', {
        RPC: result.networkRPC,
        ChainID: result.chainId
      });
  
      // Reset form if needed
      // reset();
  
    } catch (error) {
      // Handle any errors during submission
      console.error('Submission error:', error);
      
      // toast.error('Failed to create blockchain configuration', {
      //   description: error instanceof Error ? error.message : 'Unknown error occurred'
      // });
    }
  };

  const [allocInput, setAllocInput] = useState({
    address: "",
    amount: ""
  });
  useEffect(() => {
    console.log(allocInput);
  }, [allocInput]);

  const handleAllocInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAllocInput({
      ...allocInput,
      [e.target.name]: e.target.value
    });
  };

  const addAlloc = () => {
    if (allocInput.address && allocInput.amount) {
      try {
        // Validate Ethereum address (basic check)
        if (!/^0x[a-fA-F0-9]{40}$/.test(allocInput.address)) {
          console.error("Invalid Ethereum address");
          return;
        }

        // Current allocations
        const currentAlloc = watch("qbftConfig.genesis.alloc") || {};

        // 1. Convert input from ETH to wei (BigInt)
        const weiAmount = BigInt(
          ethers.parseEther(allocInput.amount).toString()
        );
        console.log("Wei Amount:", weiAmount.toString());

        // 2. Convert wei to hex representation
        const hexBalance = `0x${weiAmount.toString(16)}`;
        console.log("Hex Balance:", hexBalance);

        // Update allocations
        setValue("qbftConfig.genesis.alloc", {
          ...currentAlloc,
          [allocInput.address]: {
            balance: hexBalance
          }
        });

        // Reset input fields
        setAllocInput({ address: "", amount: "" });
      } catch (error) {
        console.error("Allocation error:", error);
      }
    }
  };


  const removeAlloc = (address: string) => {
    const currentAlloc = watch("qbftConfig.genesis.alloc");
    const { [address]: _, ...remainingAllocs } = currentAlloc;
    setValue("qbftConfig.genesis.alloc", remainingAllocs);
  };

  const currentAllocs = watch("qbftConfig.genesis.alloc");

  const truncateAddress = (address: string) => {
    return address.length > 10
      ? `${address.slice(0, 6)}...${address.slice(-4)}`
      : address;
  };
  function setNetworkDetails(arg0: { rpcUrl: any; chainId: any; }) {
    throw new Error('Function not implemented.');
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 shadow-lg rounded-lg w-full max-w-lg text-white">
      <h2 className="text-xl font-semibold text-blue-400 mb-4">Blockchain Configuration</h2>

      {/* Basic Configuration */}
      <div className="mb-4">
        <label className="block text-gray-300">Blockchain Name</label>
        <input
          type="text"
          placeholder='My Blockchain'
          {...register("chainName", { required: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300">Chain ID</label>
        <input
         type="number"
         placeholder='1337'
         {...register("qbftConfig.genesis.config.chainId", { valueAsNumber: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
        />
      </div>

      {/* Genesis Configuration */}
      <div className="mb-4 p-4 border border-gray-700 rounded">
        <h3 className="text-lg font-medium text-gray-300 mb-2">Genesis Configuration</h3>

        {/* <div className="mb-4">
          <label className="block text-gray-300">Config Chain ID (number)</label>
          <input
            type="number"
            {...register("qbftConfig.genesis.config.chainId", { valueAsNumber: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div> */}

        <div className="mb-4">
          <label className="block text-gray-300">Block Period Seconds</label>
          <input
            type="number"
            {...register("qbftConfig.genesis.config.qbft.blockperiodseconds", { valueAsNumber: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-300">Epoch Length</label>
          <input
            type="number"
            {...register("qbftConfig.genesis.config.qbft.epochlength", { valueAsNumber: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-300">Request Timeout Seconds</label>
          <input
            type="number"
            {...register("qbftConfig.genesis.config.qbft.requesttimeoutseconds", { valueAsNumber: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-300">Nonce</label>
          <input
            {...register("qbftConfig.genesis.nonce")}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        {/* <div className="mb-4">
          <label className="block text-gray-300">Timestamp</label>
          <input
            {...register("qbftConfig.genesis.timestamp")}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div> */}

        <div className="mb-4">
          <label className="block text-gray-300">Gas Limit</label>
          <input
            {...register("qbftConfig.genesis.gasLimit")}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-300">Difficulty</label>
          <input
            {...register("qbftConfig.genesis.difficulty")}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>

        {/* Allocations */}
        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Predefined Accounts (Alloc)</label>
          <div className="flex gap-2 mb-4">
            {/* Address Input */}
            <input
              type="text"
              name="address"
              value={allocInput.address || ""} // Ensure controlled input
              onChange={handleAllocInputChange}
              className="w-full p-2 border rounded bg-gray-800 text-white"
              placeholder="Enter Address (0x...)"
            />

            {/* Amount Input */}
            <input
              type="number"
              name="amount"
              value={allocInput.amount || ""} // Ensure controlled input
              onChange={handleAllocInputChange}
              className="w-full p-2 border rounded bg-gray-800 text-white"
              placeholder="Enter Amount (ETH)"
              step="0.000000000000000001"
              min="0"
            />

            <button
              type="button"
              onClick={addAlloc}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>

          {Object.keys(currentAllocs).length > 0 && (
            <div className="space-y-2">
              {Object.entries(currentAllocs).map(([address, { balance }]) => (
                <div key={address} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
                  <div className="flex gap-2 w-full">
                    <div className="w-full p-2 border rounded bg-gray-700 text-white font-mono text-sm truncate">
                      {truncateAddress(address)}
                    </div>
                    <div className="w-full p-2 border rounded bg-gray-700 text-white font-mono text-sm truncate">
                      ({(parseInt(balance, 16) / 1e18).toFixed(4)} ETH)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAlloc(address)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm whitespace-nowrap"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Node Configuration */}
      <div className="mb-4 p-4 border border-gray-700 rounded">
        <h3 className="text-lg font-medium text-gray-300 mb-2">Node Configuration</h3>
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              {...register("qbftConfig.blockchain.nodes.generate")}
              className="mr-2"
            />
            <span className="text-gray-300">Generate Nodes</span>
          </label>
        </div>
        <div className="mb-4">
          <label className="block text-gray-300">Number of Nodes</label>
          <input
            type="number"
            {...register("qbftConfig.blockchain.nodes.count", { valueAsNumber: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div>
      </div>

      {/* Features */}
      <div className="mb-4 p-4 border border-gray-700 rounded">
        <h3 className="text-lg font-medium text-gray-300 mb-2">Features</h3>
        {Object.entries({
          miningReward: "Mining Reward",
          validatorsChange: "Validators Change",
          http: "HTTP API",
          ws: "WebSocket API",
          metrics: "Metrics",
          corsOrigin: "CORS"
        }).map(([key, label]) => (
          <div key={key} className="mb-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                {...register(`features.${key as keyof BlockchainFormData['features']}`)}
                className="mr-2"
              />
              <span className="text-gray-300">{label}</span>
            </label>
          </div>
        ))}
      </div>

      <button
        type="submit"
        className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded"
      >
        Create Blockchain
      </button>
    </form>
  );
};

export default BlockchainForm;


