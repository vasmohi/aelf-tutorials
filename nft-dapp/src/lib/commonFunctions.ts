interface Nft {
  nftSymbol: string;
  balance?: number; // Adding an optional balance property for clarity
}

// Function to get the balance of a specific NFT
const getBalanceOfNft = async (
  values: {
    symbol: string,
    owner: string,
  },
  sideChainSmartContract: any
): Promise<number> => {
  // @ts-ignore
  const { data }: { data: { balance: number } } =
    await sideChainSmartContract?.callViewMethod("getBalance", values);
  return data.balance;
};

// Function to fetch balance information for an array of NFTs
const fetchNftBalances = async (
  nfts: Nft[],
  ownerAddress: string,
  sideChainSmartContract: any
): Promise<Nft[]> => {
  const nftDataWithBalances = await Promise.all(
    nfts.map(async (nft) => {
      const balance = await getBalanceOfNft(
        {
          symbol: nft.nftSymbol,
          owner: ownerAddress,
        },
        sideChainSmartContract
      );
      return { ...nft, balance };
    })
  );

  return nftDataWithBalances;
};


// fetch NFT Data from eforest API
export const fetchUserNftData = async (
  currentWalletAddress: string,
  sideChainSmartContract: any
) => {
  try {
    const response = await fetch(
      "https://test.eforest.finance/api/app/nft/nft-infos-user-profile/myhold",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ChainList: ["tDVV"],
          hasListingFlag: false,
          hasAuctionFlag: false,
          hasOfferFlag: false,
          collectionIds: [],
          address: currentWalletAddress,
          sorting: "ListingTime DESC",
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const responseData = await response.json();

    const newNftData = await fetchNftBalances(
      responseData.data.items,
      currentWalletAddress as string,
      sideChainSmartContract
    );

    return newNftData;
  } catch (error) {
    console.log(error);
    return "error"
  }
};