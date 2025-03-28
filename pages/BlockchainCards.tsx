import React, { useState, useEffect } from 'react';
import { getStoredBlockchainData } from '../utils/BlockchianData';
import Modal from 'react-modal';

interface Blockchain {
  chainName: string;
  address: string;
  chainId: number;
  consensus: string;
  network: string;
  networkRPC: string;
}
interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on?: (event: string, callback: (...args: any[]) => void) => void;
    removeListener?: (event: string, callback: (...args: any[]) => void) => void;
    // Add other ethereum provider methods you need
  };
}
// Set app element for accessibility
Modal.setAppElement('#__next');

const BlockchainCards = () => {
  const [blockchains, setBlockchains] = useState<Blockchain[]>([]);
  const [selectedChain, setSelectedChain] = useState<Blockchain | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initialize with default blockchains and stored data
  useEffect(() => {
    const defaultBlockchains: Blockchain[] = [
      {
        chainName: 'EnterpriseChain',
        address: '0xE0...075c',
        chainId: 137,
        consensus: 'QBFT',
        network: 'Ethereum Mainnet 💹',
        networkRPC: 'https://eth-mainnet.public.blastapi.io'
      },
      {
        chainName: 'QuickLedger',
        address: '0x82...0707',
        chainId: 80001,
        consensus: 'IBFT',
        network: 'Polygon Testnet 💹',
        networkRPC: 'https://matic-mumbai.chainstacklabs.com'
      },
      {
        chainName: 'SecureNet',
        address: '0x2d...33f4',
        chainId: 56,
        consensus: 'QBFT',
        network: 'Binance Smart Chain 💹',
        networkRPC: 'https://bsc-dataseed.binance.org'
      },
      {
        chainName: 'FastBlock',
        address: '0x7A...b798',
        chainId: 43114,
        consensus: 'IBFT',
        network: 'Avalanche 💹',
        networkRPC: 'https://api.avax.network/ext/bc/C/rpc'
      }
    ];

    const storedData = getStoredBlockchainData();
    const allBlockchains = [...defaultBlockchains];

    // Add stored blockchains if they don't already exist
    if (storedData && storedData.length > 0) {
      storedData.forEach(storedChain => {
        if (!allBlockchains.some(b => b.chainId === storedChain.chainId)) {
          allBlockchains.push(storedChain);
        }
      });
    }

    setBlockchains(allBlockchains);
  }, []);

  const removeBlockchain = (chainId: number) => {
    setBlockchains(prev => prev.filter(b => b.chainId !== chainId));

    // Update localStorage if needed
    if (typeof window !== 'undefined') {
      const storedData = localStorage.getItem('blockchainNetworks');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          const updatedData = parsedData.filter((chain: Blockchain) => chain.chainId !== chainId);
          localStorage.setItem('blockchainNetworks', JSON.stringify(updatedData));
        } catch (e) {
          console.error('Error updating stored blockchain data:', e);
        }
      }
    }
  };

  const openChainModal = (chain: Blockchain) => {
    setSelectedChain(chain);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedChain(null);
  };

  const addToMetaMask = async () => {
    if (!selectedChain || !(window as any).ethereum) return;

    try {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: `0x${selectedChain.chainId.toString(16)}`,
          chainName: selectedChain.chainName,
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: [selectedChain.networkRPC],
          blockExplorerUrls: ['https://etherscan.io']
        }]
      });
    } catch (error) {
      console.error('Error adding chain to MetaMask:', error);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-black py-12 px-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-300 mb-8 text-center">
          Your Blockchains
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {blockchains.map((chain, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 hover:border-orange-500 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer"
              onClick={() => openChainModal(chain)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-white">#{chain.chainName}</h3>
                <span className="text-xs bg-gray-700 text-orange-400 px-2 py-1 rounded-full">
                  {chain.consensus}
                </span>
              </div>

              <p className="text-sm text-gray-400 mb-6 font-mono truncate">{chain.networkRPC}</p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Chain ID:</span>
                  <span className="font-medium text-white">{chain.chainId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Consensus:</span>
                  <span className="font-medium text-white">{chain.consensus}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs bg-gray-700 text-white px-3 py-1 rounded-full flex items-center">
                  {chain.network}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBlockchain(chain.chainId);
                  }}
                  className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1 rounded-full transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chain Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeModal}
        contentLabel="Blockchain Details"
        className="modal-content bg-gray-800 rounded-xl p-6 max-w-md mx-auto mt-20 outline-none border border-gray-700"
        overlayClassName="modal-overlay fixed inset-0 bg-black bg-opacity-70 flex items-start justify-center z-50"
      >
        {selectedChain && (
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-white">{selectedChain.chainName}</h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Network RPC</p>
                <p className="text-white font-mono break-all">{selectedChain.networkRPC}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Chain ID</p>
                  <p className="text-white">{selectedChain.chainId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Consensus</p>
                  <p className="text-white">{selectedChain.consensus}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Network</p>
                  <p className="text-white">{selectedChain.network}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Address</p>
                  <p className="text-white">{selectedChain.address}</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={addToMetaMask}
                disabled={!(window as any).ethereum}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(window as any).ethereum ? 'Add to MetaMask' : 'MetaMask not detected'}
              </button>
              <button
                onClick={closeModal}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BlockchainCards;