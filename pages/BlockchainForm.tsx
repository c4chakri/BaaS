import { log } from 'node:console';
import React, { use, useState, useEffect, useCallback } from 'react';
import { useForm, useFormContext, useWatch } from 'react-hook-form';
import { toWei, toHex } from 'web3-utils';
import { ethers } from 'ethers';
import router from 'next/router';
// import {toast} from 'toast';
import { getStoredBlockchainData } from '../utils/BlockchianData';

interface BlockchainFormData {
  chainName: string;
  consensus: string;
  network: string;
  qbftConfig: {
    genesis: {
      config: {
        chainId: number | null;
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
interface Blockchain {
  chainName: string;
  address: string;
  chainId: number;
  consensus: string;
  network: string;
}
const BlockchainForm = () => {
  const { register,
    handleSubmit,
    watch,
    setValue,
    control,  // Add control to the destructured properties
    formState: { errors } } = useForm<BlockchainFormData>({
      defaultValues: {
        chainName: "",
        consensus: "QBFT",
        network: "Testnet",
        qbftConfig: {
          genesis: {
            config: {
              chainId:null ,
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

    const [existingBlockchains, setExistingBlockchains] = useState<Blockchain[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // Watch relevant form fields
  const chainName = useWatch({ control, name: 'chainName' });
  const chainId = useWatch({ control, name: 'qbftConfig.genesis.config.chainId' });

  const checkForExistingBlockchain = useCallback(() => {
    if (!chainName && !chainId) return; // Skip if no values to check
    
    setIsChecking(true);
    const storedData = getStoredBlockchainData();
    setExistingBlockchains(storedData);
    setIsChecking(false);
  }, [chainName, chainId]);
  
  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(checkForExistingBlockchain, 500);
    return () => clearTimeout(timer);
  }, [chainName, chainId, checkForExistingBlockchain]);
  
  // Determine conflicts
  const hasNameConflict = existingBlockchains.some(b => b.chainName === chainName);
  const hasIdConflict = existingBlockchains.some(b => b.chainId === Number(chainId));
  const [isLoading, setIsLoading] = useState(false);


  const onSubmit = async (data: BlockchainFormData) => {
    try {
      if (hasNameConflict || hasIdConflict) {
        alert('Please resolve conflicts with existing blockchain before submitting');
        return;
      }
      // Your form submission logic here
      console.log('Form submitted:', data);
      console.log("API Payload:", data);
      setIsLoading(true);
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
      // const response = {
      //   ok: true,
      //   status: 200,
      //   statusText: "OK",
      //   json: async () => ({
      //     networkRPC: "http://localhost:8545",
      //     chainId: 235,
      //     consensus: "QBFT",
      //     network: "Testnet"
      //   })}

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. 
           Details: ${JSON.stringify(errorData)}`
        );
      }

      const result = await response.json();

      if (typeof window !== 'undefined') {
        // 1. Get existing data from localStorage or initialize empty array
        const existingDataString = localStorage.getItem('blockchainNetworks');
        let existingData: any[] = [];

        if (existingDataString) {
          try {
            existingData = JSON.parse(existingDataString);
            if (!Array.isArray(existingData)) {
              // Handle case where stored data isn't an array
              existingData = [existingData]; // Convert to array
            }
          } catch (e) {
            console.error('Error parsing existing blockchain data:', e);
            existingData = [];
          }
        }

        // 2. Create new storage data
        const newData = {
          chainName: result.chainName,
          networkRPC: result.networkRPC,
          chainId: result.chainId,
          consensus: result.consensus,
          network: result.network,
          timestamp: new Date().toISOString()
        };

        // 3. Append new data to existing array
        const updatedData = [...existingData, newData];

        // 4. Store back to localStorage
        localStorage.setItem('blockchainNetworks', JSON.stringify(updatedData));
      }

      console.log('Blockchain Network Details:', {
        RPC: result.networkRPC,
        ChainID: result.chainId,
        consensus: result.consensus,
        network: result.network
      });
      setIsLoading(false);
      router.push('/');
    } catch (error) {
      console.error('Submission error:', error);
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


  const checkBlockchain = () => {
    const networkData = getStoredBlockchainData()
    console.log("Network Data:", networkData);

  }

  checkBlockchain()

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 shadow-lg rounded-lg w-full max-w-lg text-white">
      <h2 className="text-xl font-semibold text-blue-400 mb-4">Blockchain Configuration</h2>

      {/* Basic Configuration */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-1">
          Blockchain Name
          {isChecking && (
            <span className="ml-2 text-xs text-gray-400">(verifying...)</span>
          )}
        </label>
        <input
          type="text"
          placeholder='Mobius Blockchain'
          {...register('chainName', {
            required: 'Blockchain name is required',
            validate: {
              conflict: () => !hasNameConflict || 'This name matches an existing blockchain'
            }
          })}
          className={`w-full p-2 border rounded bg-gray-800 text-white ${errors.chainName || hasNameConflict ? 'border-red-500' : 'border-gray-600'
            }`}
          aria-invalid={!!errors.chainName || hasNameConflict}
        />
        {errors.chainName && (
          <p className="mt-1 text-sm text-red-500" role="alert">
            {errors.chainName.message}
          </p>
        )}
        {hasNameConflict && !errors.chainName && (
          <p className="mt-1 text-sm text-yellow-500" role="alert">
            Warning: This name matches an existing blockchain configuration
          </p>
        )}
      </div>
      <div className="mb-4">
        <label className="block text-gray-300 text-sm font-medium mb-1">
          Chain ID
          {isChecking && (
            <span className="ml-2 text-xs text-gray-400">(verifying...)</span>
          )}
        </label>
        <input
          type="number"
          placeholder='11155111'
          {...register('qbftConfig.genesis.config.chainId', {
            required: 'Chain ID is required',
            valueAsNumber: true,
            min: {
              value: 1,
              message: 'Chain ID must be positive'
            },
            validate: {
              conflict: () => !hasIdConflict || 'This ID matches an existing blockchain'
            }
          })}
          className={`w-full p-2 border rounded bg-gray-800 text-white ${errors.qbftConfig?.genesis?.config?.chainId || hasIdConflict
            ? 'border-red-500'
            : 'border-gray-600'
            }`}
          aria-invalid={!!errors.qbftConfig?.genesis?.config?.chainId || hasIdConflict}
        />
        {errors.qbftConfig?.genesis?.config?.chainId && (
          <p className="mt-1 text-sm text-red-500" role="alert">
            {errors.qbftConfig.genesis.config.chainId.message}
          </p>
        )}
        {hasIdConflict && !errors.qbftConfig?.genesis?.config?.chainId && (
          <p className="mt-1 text-sm text-yellow-500" role="alert">
            Warning: This ID matches an existing blockchain configuration
          </p>
        )}
      </div>

      {/* <div className="mb-4">
        <label className="block text-gray-300">Chain ID</label>
        <input
          type="number"
          placeholder='1337'
          {...register("qbftConfig.genesis.config.chainId", { valueAsNumber: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
        />
      </div> */}

      <div className="mb-4">
        <label className="block text-gray-300">Network</label>
        <input
          type="text"
          placeholder='Testnet'
          {...register("network", { required: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
        />
      </div>
      <div className="mb-4">
        <label className="block text-gray-300">Consensus</label>
        <input
          type="text"
          placeholder='QBFT'
          {...register("consensus", { required: true })}
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

        {/* <div className="mb-4">
          <label className="block text-gray-300">Epoch Length</label>
          <input
            type="number"
            {...register("qbftConfig.genesis.config.qbft.epochlength", { valueAsNumber: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
          />
        </div> */}

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
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
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
        className={`mt-6 px-6 py-3 bg-orange-500 text-black font-semibold rounded-lg shadow-lg hover:bg-orange-700 transition w-full text-white font-bold rounded flex items-center justify-center ${isLoading ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'
          }`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating...
          </>
        ) : (
          'Create Blockchain'
        )}
      </button>


    </form>
  );
};

export default BlockchainForm;


