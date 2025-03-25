"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

interface BlockchainFormData {
  chainName: string;
  chainId: number;
  consensusMechanism: "QBFT" | "IBFT 2.0";
  blockTime: number;
  genesisFile: {
    allocs: { address: string; amount: string }[];
    gasFees: {
      baseFeePerGas: string;
      gasLimit: string;
    };
    validators: string[];
  };
  features: {
    miningReward: boolean;
    validatorsChange: boolean;
    http: boolean;
    ws: boolean;
    metrics: boolean;
    corsOrigin: boolean;
  };
  allowedList: string[];
}

export default function BlockchainForm() {
  const { register, handleSubmit, watch, setValue } = useForm<BlockchainFormData>({
    defaultValues: {
      consensusMechanism: "QBFT",
      blockTime: 2,
      genesisFile: {
        allocs: [],
        gasFees: {
          baseFeePerGas: "",
          gasLimit: "",
        },
        validators: [],
      },
      features: {
        miningReward: false,
        validatorsChange: true,
        http: true,
        ws: true,
        metrics: true,
        corsOrigin: true,
      },
      allowedList: [],
    },
  });

  const [allocs, setAllocs] = useState<{ address: string; amount: string }[]>([]);
  const [newAlloc, setNewAlloc] = useState({ address: "", amount: "" });
  const [validator, setValidator] = useState<string>("");

  const consensus = watch("consensusMechanism");

  useEffect(() => {
    console.log("Allocations:", allocs);
  }, [allocs]);

  useEffect(() => {
    console.log("New Allocation:", newAlloc);
  }, [newAlloc]);

  const onSubmit = (data: BlockchainFormData) => {
    // Merge the allocs state into the form data
    const formData = {
      ...data,
      genesisFile: {
        ...data.genesisFile,
        allocs: allocs,
      },
    };
    console.log("Blockchain Configuration:", formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewAlloc({ ...newAlloc, [e.target.name]: e.target.value });
  };

  const addAlloc = () => {
    if (newAlloc.address && newAlloc.amount) {
      const updatedAllocs = [...allocs, newAlloc];
      setAllocs(updatedAllocs);
      setValue("genesisFile.allocs", updatedAllocs); // Update the form state
      setNewAlloc({ address: "", amount: "" });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gradient-to-br  from-gray-800 to-gray-900 p-6 shadow-lg rounded-lg w-full max-w-lg text-white">
      <h2 className="text-xl font-semibold text-blue-400 mb-4">Blockchain Configuration</h2>

      <div className="mb-4">
        <label className="block text-gray-300">Blockchain Name</label>
        <input
          {...register("chainName", { required: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
          placeholder="MyBlockchain"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300">Chain ID</label>
        <input
          type="number"
          {...register("chainId", { required: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
          placeholder="2018"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300">Consensus Mechanism</label>
        <select
          {...register("consensusMechanism")}
          className="w-full p-2 border rounded bg-gray-800 text-white"
        >
          <option value="QBFT">QBFT</option>
          <option value="IBFT 2.0">IBFT 2.0</option>
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-gray-300">Block Time (2-5 sec)</label>
        <input
          type="number"
          {...register("blockTime", { min: 2, max: 5 })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
          placeholder="2"
        />
      </div>

      <div className="mb-4 p-4 border border-gray-700 rounded">
        <label className="block text-gray-300 mb-2">Predefined Accounts (Allocs)</label>

        {/* Input Fields for New Allocation */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            name="address"
            value={newAlloc.address}
            onChange={handleInputChange}
            className="w-full p-2 border rounded bg-gray-800 text-white mb-2"
            placeholder="Enter Address"
          />
          <input
            type="number"
            name="amount"
            value={newAlloc.amount}
            onChange={handleInputChange}
            className="w-full p-2 border rounded bg-gray-800 text-white mb-2"
            placeholder="Enter Amount (Wei)"
          />
          <button
            onClick={addAlloc}
            className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
          >
            Add
          </button>
        </div>

        {/* Display Allocations */}
        {allocs.length > 0 && (
          <div>
            {allocs.map((alloc, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={alloc.address}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-800 text-white"
                />
                <input
                  type="text"
                  value={alloc.amount}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-800 text-white"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-gray-300">Gas Fees</label>
        <input
          {...register("genesisFile.gasFees.baseFeePerGas", { required: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white mb-2"
          placeholder="Base Fee Per Gas"
        />
        <input
          {...register("genesisFile.gasFees.gasLimit", { required: true })}
          className="w-full p-2 border rounded bg-gray-800 text-white"
          placeholder="Gas Limit"
        />
      </div>

      {consensus === "IBFT 2.0" && (
        <div className="mb-4">
          <label className="block text-gray-300">Allowed List Address</label>
          <input
            {...register("allowedList.0", { required: true })}
            className="w-full p-2 border rounded bg-gray-800 text-white"
            placeholder="0x123456..."
          />
        </div>
      )}

      <div className="mb-4">
        <label className="block text-gray-300 text-lg font-semibold">Features</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {["miningReward", "validatorsChange"].map((key) => (
            <div key={key} className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
              <h3 className="text-white font-medium text-lg mb-2">{key}</h3>

              <div className="flex items-center gap-4">
                {/* Yes Option */}
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...register(`features.${key as keyof BlockchainFormData["features"]}`)}
                    value='true'
                    className="mr-1"
                  />
                  <span className="text-gray-300">Enabled</span>
                </label>

                {/* No Option */}
                <label className="flex items-center">
                  <input
                    type="radio"
                    {...register(`features.${key as keyof BlockchainFormData["features"]}`)}
                    value='false'
                    className="mr-1"
                  />
                  <span className="text-gray-300">No</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded mt-4 hover:bg-blue-600 transition"
      >
        Create Blockchain
      </button>
    </form>
  );
}