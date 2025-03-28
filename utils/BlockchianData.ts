interface Blockchain {
    chainName: string;
    address: string;
    chainId: number;
    consensus: string;
    network: string;
    networkRPC: string;
    timestamp?: string; // Optional timestamp for tracking when added
  }
  
  /**
   * Retrieves all stored blockchain networks from localStorage
   * @returns Array of Blockchain objects or empty array if none exist
   */
  export const getStoredBlockchainData = (): Blockchain[] => {
    if (typeof window !== 'undefined') {
      const storedData = localStorage.getItem('blockchainNetworks'); // Note plural key
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          
          // Handle case where single network was stored (backward compatibility)
          if (!Array.isArray(parsedData)) {
            return [{
              chainName: parsedData.chainName || 'Custom Blockchain',
              address: parsedData.address || '0x...',
              chainId: Number(parsedData.chainId),
              consensus: parsedData.consensus || 'Unknown',
              network: parsedData.network || 'Custom Network',
              networkRPC: parsedData.networkRPC || 'http://localhost:8545',
              timestamp: parsedData.timestamp || new Date().toISOString()
            }];
          }
  
          // Normal case - return array with proper defaults
          return parsedData.map((network: any) => ({
            chainName: network.chainName || 'Custom Blockchain',
            address: network.address || '0x...',
            chainId: Number(network.chainId),
            consensus: network.consensus || 'Unknown',
            network: network.network || 'Custom Network',
            networkRPC: network.networkRPC || 'http://localhost:8545',
            timestamp: network.timestamp || new Date().toISOString()
          }));
  
        } catch (e) {
          console.error('Error parsing stored blockchain data:', e);
        }
      }
    }
    return []; // Return empty array instead of null for easier consumption
  };
  
  /**
   * Stores a new blockchain network (appends to existing ones)
   */
  export const storeBlockchainData = (newNetwork: Omit<Blockchain, 'timestamp'>): void => {
    if (typeof window !== 'undefined') {
      const existingNetworks = getStoredBlockchainData();
      const updatedNetworks = [
        ...existingNetworks,
        {
          ...newNetwork,
          timestamp: new Date().toISOString() // Add timestamp
        }
      ];
      localStorage.setItem('blockchainNetworks', JSON.stringify(updatedNetworks));
    }
  };
  
  /**
   * Gets a single blockchain by chainId (returns undefined if not found)
   */
  export const getBlockchainByChainId = (chainId: number): Blockchain | undefined => {
    return getStoredBlockchainData().find(network => network.chainId === chainId);
  };
  
  /**
   * Checks if a blockchain with given chainId or name already exists
   */
  export const blockchainExists = (chainId: number, chainName: string): boolean => {
    const networks = getStoredBlockchainData();
    return networks.some(network => 
      network.chainId === chainId || 
      network.chainName.toLowerCase() === chainName.toLowerCase()
    );
  };