import { IPortkeyProvider, IChain } from "@portkey/provider-types";
import { useEffect, useState } from "react";

type IContract = ReturnType<IChain["getContract"]>;

// Custom Hook for interacting with NFT Smart Contracts
const useNFTSmartContract = (provider: IPortkeyProvider | null) => {
  // State variables to store the smart contract instances
  const [mainChainSmartContract, setMainChainSmartContract] = useState<ReturnType<IChain["getContract"]>>();
  const [sideChainSmartContract, setSideChainSmartContract] = useState<ReturnType<IChain["getContract"]>>();

  //Step A - Function to fetch a smart contract based on the chain symbol and the contract address
  const fetchContract = async (
    symbol: "AELF" | "tDVW",
    contractAddress: string
  ) => {
    try {
      // If no provider is available, return null
      if (!provider) return null;

      // Fetch the chain information using the provider
      const chain = await provider.getChain(symbol);
      if (!chain) throw new Error("Chain not found");

      // Get the smart contract instance from the chain
      const contract = chain.getContract(contractAddress);

      // Return the smart contract instance
      return contract;
    } catch (error) {
      console.error("Error in fetchContract", { symbol, contractAddress, error });
    }
  };


  // Step B -  Effect hook to initialize and fetch the smart contracts when the provider changes
    useEffect(() => {
      (async () => {
        // Fetch the MainChain Testnet Contract
        const mainChainContract = await fetchContract(
          "AELF",
          "JRmBduh4nXWi1aXgdUsj5gJrzeZb2LxmrAbf7W99faZSvoAaE"
        );
        setMainChainSmartContract(mainChainContract as IContract);

        // Fetch the SideChain Testnet Contract
        const sideChainContract = await fetchContract(
          "tDVW",
          "ASh2Wt7nSEmYqnGxPPzp4pnVDU4uhj1XW9Se5VeZcX2UDdyjx"
        );
        setSideChainSmartContract(sideChainContract as IContract);
      })();
    }, [provider]); // Dependency array ensures this runs when the provider changes

  // Return the smart contract instances
  return {
    mainChainSmartContract,
    sideChainSmartContract,
  };
};

export default useNFTSmartContract;
