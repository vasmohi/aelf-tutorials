import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
// @ts-ignore
import AElf from "aelf-sdk";
import { Buffer } from "buffer";
import { toast } from "react-toastify";

import { IPortkeyProvider } from "@portkey/provider-types";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import detectProvider from "@portkey/detect-provider";
import { Button } from "@/components/ui/button";
import useNFTSmartContract from "@/hooks/useNFTSmartContract";
import "./create-nft.scss";

import { CustomToast, delay, removeNotification } from "@/lib/utils";
import { InfoIcon } from "@/components/ui/icons";

const formSchema = z.object({
  tokenName: z.string(),
  symbol: z.string(),
  totalSupply: z.string(),
  decimals: z.string(),
});

interface INftInput {
  symbol: string;
  tokenName: string;
  totalSupply: string;
  decimals: string;
  issuer: string;
  isBurnable: boolean;
  issueChainId: number;
  owner: string;
}

interface INftParams {
  tokenName: string;
  symbol: string;
  totalSupply: string;
}

interface INftValidateResult {
  parentChainHeight: string | number;
  signedTx: string;
  merklePath: { merklePathNodes: any };
}

const wallet = AElf.wallet.getWalletByPrivateKey(
  "4e83df2aa7c8552a75961f9ab9f2f06e01e0dca0203e383da5468bbbe2915c97"
);

const CreateNftPage = ({
  currentWalletAddress,
}: {
  currentWalletAddress: string;
}) => {
  const [provider, setProvider] = useState<IPortkeyProvider | null>(null);
  const { mainChainSmartContract, sideChainSmartContract } = useNFTSmartContract(provider);
  const [transactionStatus, setTransactionStatus] = useState<boolean>(false);
  const [isNftCollectionCreated, setIsNftCollectionCreated] =
    useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams(location.search);
  const isNftCreate = searchParams.get("nft-create");

  const mainchain_from_chain_id = 9992731;
  const sidechain_from_chain_id = 1931928;

  const tdvw = new AElf(
    new AElf.providers.HttpProvider("https://tdvw-test-node.aelf.io")
  );

  const aelf = new AElf(
    new AElf.providers.HttpProvider("https://aelf-test-node.aelf.io")
  );

  const handleReturnClick = () => {
    navigate("/");
  };

  const init = async () => {
    try {
      setProvider(await detectProvider());
    } catch (error) {
      console.log(error, "=====error");
    }
  };

  useEffect(() => {
    if (!provider) init();
  }, [provider]);

  useEffect(() => {
    if (isNftCreate) {
      setIsNftCollectionCreated(true);
    }
  }, [isNftCreate]);

  const connect = async (walletProvider?: IPortkeyProvider) => {
    // Step C - Connect Portkey Wallet
    const accounts = await (walletProvider ? walletProvider : provider)?.request({
      method: MethodsBase.REQUEST_ACCOUNTS,
    });
    const account = accounts?.AELF && accounts?.AELF[0];
    if (account) {
      setCurrentWalletAddress(account.replace(/^ELF_/, "").replace(/_AELF$/, ""));
      setIsConnected(true);
    }
    !walletProvider && toast.success("Successfully connected");
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tokenName: "",
      symbol: "",
      totalSupply: "",
      decimals: "",
    },
  }); 
  
  

  // Get Token Contract
  const getTokenContract = async (aelf: any, wallet: any) => {
    const tokenContractName = "AElf.ContractNames.Token";
    // get chain status
    const chainStatus = await aelf.chain.getChainStatus();
    // get genesis contract address
    const GenesisContractAddress = chainStatus.GenesisContractAddress;
    // get genesis contract instance
    const zeroContract = await aelf.chain.contractAt(
      GenesisContractAddress,
      wallet
    );
    // Get contract address by the read only method `GetContractAddressByName` of genesis contract
    const tokenContractAddress =
      await zeroContract.GetContractAddressByName.call(
        AElf.utils.sha256(tokenContractName)
      );

    return await aelf.chain.contractAt(tokenContractAddress, wallet);
  };

  // Get CrossChain Contract
  const getCrossChainContract = async (aelf:any, wallet: any) => {
    const crossChainContractName = "AElf.ContractNames.CrossChain";
  
    // get chain status
    const chainStatus = await aelf.chain.getChainStatus();
    // get genesis contract address
    const GenesisContractAddress = chainStatus.GenesisContractAddress;
    // get genesis contract instance
    const zeroContract = await aelf.chain.contractAt(
      GenesisContractAddress,
      wallet
    );
    // Get contract address by the read only method `GetContractAddressByName` of genesis contract
    const crossChainContractAddress =
      await zeroContract.GetContractAddressByName.call(
        AElf.utils.sha256(crossChainContractName)
      );
  
    return await aelf.chain.contractAt(crossChainContractAddress, wallet);
  };

  //============== Create NFT Collection Steps =================//

  // step - 1 Create New NFT Collection on the mainchain
  const createNftCollectionOnMainChain = async (values: {
    tokenName: string;
    symbol: string;
    totalSupply: string;
    decimals: string;
  }) => {
    try {
      const createLoadingId = toast.loading("Creating NFT Collection..");

      // Create an object with the necessary information for the new NFT collection.
      const createNtfInput: INftInput = {
        tokenName: values.tokenName, // Name of the nft Collection
        symbol: values.symbol, // Symbol of the token (You have to get it from your PortKey wallet on NFT seed from NFT section)
        totalSupply: values.totalSupply, // Total supply of the token
        decimals: values.decimals, // Decimals of the token
        issuer: currentWalletAddress, // Address of the token issuer
        isBurnable: true, // Indicates if the token can be burned
        issueChainId: sidechain_from_chain_id, // ID of the issuing chain
        owner: currentWalletAddress, // Owner's wallet address
      };

      // Call the smart contract method to create the new NFT collection on the main chain.
      const result = await mainChainSmartContract?.callSendMethod(
        "Create",
        currentWalletAddress,
        createNtfInput
      );

      // Log the result of the creation for debugging purposes.
      console.log("========= result of createNewNft =========", result);

      toast.update(createLoadingId, {
        render: "NFT Collection Created Successfully On MainChain",
        type: "success",
        isLoading: false,
      });
      removeNotification(createLoadingId);

      // Return the input data for further use.
      return createNtfInput;
    } catch (error: any) {
      // If there's an error, log it and alert the user.
      console.error(error.message, "=====error");
      toast.error(error.message);
      return "error";
    }
  };


// step 2 - Validate Collection information exist
// This function validates if the token collection information already exists on the main blockchain.
const validateNftCollectionInfo = async (values: INftInput) => {
  try {

    // Start Loading before initiate the transaction
    const validateLoadingId = toast.loading(
      <CustomToast
        title="Transaction is getting validated on aelf blockchain. Please wait!"
        message="Validation means transaction runs through a consensus algorithm to be selected or rejected. Once the status changes process will complete. It usually takes some time in distributed systems."
      />
    );

    // Create an object with the necessary information for token validation.
    const validateInput = {
      symbol: values.symbol, // Symbol of the token
      tokenName: values.tokenName, // Name of the token
      totalSupply: values.totalSupply, // Total supply of the token
      decimals: values.decimals, // Decimals of the token
      issuer: currentWalletAddress, // Address of the token issuer
      isBurnable: true, // Indicates if the token can be burned
      issueChainId: sidechain_from_chain_id, // ID of the issuing chain
      owner: currentWalletAddress, // Owner's wallet address
    };

    // get mainnet contract
    const aelfTokenContract = await getTokenContract(aelf, wallet);

    // prepare Sign the transaction using contract method (ValidateTokenInfoExists Function)
    const signedTx = aelfTokenContract.ValidateTokenInfoExists.getSignedTx(validateInput);

    // send the transaction using signed Transaction
    const { TransactionId: VALIDATE_TXID } = await aelf.chain.sendTransaction(
      signedTx
    );

    // get Validate Result
    let VALIDATE_TXRESULT = await aelf.chain.getTxResult(VALIDATE_TXID);

    // we need to wait till our latest index Hight grater than or equal to our Transaction block number
    let heightDone = false;

    while (!heightDone) {
      // get latest index Hight
      const sideIndexMainHeight = await GetParentChainHeight();
      if (
        // check the latest index Hight is grater than or equal
        sideIndexMainHeight >= VALIDATE_TXRESULT.Transaction.RefBlockNumber
      ) {
        VALIDATE_TXRESULT = await aelf.chain.getTxResult(VALIDATE_TXID);
        heightDone = true;
      }
    }

    console.log("VALIDATE_TXRESULT", VALIDATE_TXRESULT);

    // Update the Loading Message
    toast.update(validateLoadingId, {
      render: "Validating Token Successfully Executed",
      type: "success",
      isLoading: false,
    });

    // Remove the Loading Message
    removeNotification(validateLoadingId);

    // Return necessary details.
    return {
      transactionId: VALIDATE_TXID,
      signedTx: signedTx,
      BlockNumber: VALIDATE_TXRESULT.BlockNumber,
    };

  } catch (error: any) {
    // If there's an error, log it and alert the user.
    console.error(error.message, "=====error in validateTokenInfoExist");
    toast.error(`error in validateTokenInfoExist ${error.message}`);
    return "error";
  }
};

  // Step 3: Get the parent chain height
  // This function fetches the current height of the parent blockchain.
  const GetParentChainHeight = async () => {
    try {
      const tdvwCrossChainContract = await getCrossChainContract(tdvw, wallet);
      // Call the smart contract method to get the parent chain height.
      const result = await tdvwCrossChainContract.GetParentChainHeight.call() 
      // Return the parent chain height if it exists, otherwise return an empty string.
      return result ? (result.value as string) : "";
    } catch (error: any) {
      // If there's an error, log it and return an error status.
      console.error(error, "=====error in GetParentChainHeight");
      return "error";
    }
  };

  // step 4 - Fetch the merkle path by transaction Id
const getMerklePathByTxId = async (aelf: any, txId: string) => {
  try {
    const { MerklePathNodes } = await aelf.chain.getMerklePathByTxId(txId);

    const formattedMerklePathNodes = MerklePathNodes.map(
      ({
        Hash,
        IsLeftChildNode,
      }: {
        Hash: string,
        IsLeftChildNode: boolean,
      }) => ({
        hash: Hash,
        isLeftChildNode: IsLeftChildNode,
      })
    );

    return { merklePathNodes: formattedMerklePathNodes };
  } catch (error) {
    console.error("Error fetching Merkle path:", error);
    throw new Error("Failed to get Merkle path by transaction ID.");
  }
};


// step 5 - Create a collection on the sidechain
const createCollectionOnSideChain = async (
  transactionId: string,
  signedTx: string,
  BlockNumber: number
) => {
  try {
    const crossChainLoadingId = toast.loading(
      "Creating Collection on SideChain..."
    );

      const merklePath = await getMerklePathByTxId(aelf, transactionId);

      const tdvwTokenContract = await getTokenContract(tdvw, wallet);

      const CROSS_CHAIN_CREATE_TOKEN_PARAMS = {
        fromChainId: mainchain_from_chain_id,
        parentChainHeight: "" + BlockNumber,
        // @ts-ignore
        transactionBytes: Buffer.from(signedTx, "hex").toString("base64"),
        merklePath,
      };
      const signedTx2 =
        await tdvwTokenContract.CrossChainCreateToken.getSignedTx(
          CROSS_CHAIN_CREATE_TOKEN_PARAMS
        );

      let done = false;

      while (!done) {
        try {
          await delay(10000);
          const { TransactionId } = await tdvw.chain.sendTransaction(signedTx2);
          const txResult = await tdvw.chain.getTxResult(TransactionId);

          if (txResult.Status === "SUCCESS" || txResult.Status === "MINED") {
            done = true;
            setIsNftCollectionCreated(true);
            toast.update(crossChainLoadingId, {
              render: "Collection was Created Successfully On SideChain",
              type: "success",
              isLoading: false,
            });
            removeNotification(crossChainLoadingId);
            toast.info("You Can Create NFT now");
            setTransactionStatus(false);
          }
        } catch (err: any) {
          console.log(err);
          if (err.Error.includes("Cross chain verification failed.")) {
            console.log("Exit.");
            done = true;
          }
        }
      }
      return "success";
    } catch (error) {
      console.log("error====", error);
      return "error";
    }
  };


  //============== Create NFT Token Steps =================//

// step 6 - Create an NFT on the mainchain
const createNFTOnMainChain = async (values: {
  tokenName: string;
  symbol: string;
  totalSupply: string;
}) => {
  let createMainChainNFTLoadingId;

  try {
    createMainChainNFTLoadingId = toast.loading(
      "Creating NFT on MainChain..."
    );

    // Preparing Parameter for Create Function
    const createNtfMainChainInput = {
      tokenName: values.tokenName,
      symbol: values.symbol,
      totalSupply: values.totalSupply,
      issuer: currentWalletAddress,
      isBurnable: true,
      issueChainId: sidechain_from_chain_id,
      owner: currentWalletAddress,
      externalInfo: {},
    };

    const resultMainchain = await mainChainSmartContract?.callSendMethod(
      "Create",
      currentWalletAddress,
      createNtfMainChainInput
    );

    console.log(
      "========= result of createNewNft =========",
      resultMainchain
    );

    toast.update(createMainChainNFTLoadingId, {
      render: "NFT Created Successfully on MainChain",
      type: "success",
      isLoading: false,
    });
    removeNotification(createMainChainNFTLoadingId);

    return "success";
  } catch (error: any) {
    if (!createMainChainNFTLoadingId) {
      return "error";
    }
    toast.update(createMainChainNFTLoadingId, {
      render: error.message,
      type: "error",
      isLoading: false,
    });
    removeNotification(createMainChainNFTLoadingId, 5000);
    return "error";
  }
};

// step 7 - Validate an NFT token on the maincgit stashhain
const validateNftToken = async (values: INftParams) => {
  try {
    // Start Loading before initiate the transaction
    const validateNFTLoadingId = toast.loading(
      <CustomToast
        title="Transaction is getting validated on aelf blockchain. Please wait!"
        message="Validation means transaction runs through a consensus algorithm to be selected or rejected. Once the status changes process will complete. It usually takes some time in distributed systems."
      />
    );

    // Create an object with the necessary information for token validation.
    const validateInput = {
      symbol: values.symbol,
      tokenName: values.tokenName,
      totalSupply: values.totalSupply,
      issuer: currentWalletAddress,
      isBurnable: true,
      issueChainId: sidechain_from_chain_id,
      owner: currentWalletAddress,
      externalInfo: {},
    };

    // get mainnet contract
    const aelfTokenContract = await getTokenContract(aelf, wallet);

    // prepare Sign the transaction using contract method (ValidateTokenInfoExists Function)
    const signedTx =
      aelfTokenContract.ValidateTokenInfoExists.getSignedTx(validateInput);

    // send the transaction using signed Transaction
    const { TransactionId: VALIDATE_TXID } = await aelf.chain.sendTransaction(
      signedTx
    );

    await delay(3000);

    // get Validate Result
    let VALIDATE_TXRESULT = await aelf.chain.getTxResult(VALIDATE_TXID);

    await delay(3000);

    // if SideChain index has a MainChain height greater than validateTokenInfoExist's
    let heightDone = false;

    while (!heightDone) {
      // get latest index Hight
      const sideIndexMainHeight = await GetParentChainHeight();
      if (
        // check the latest index Hight is grater than or equal
        sideIndexMainHeight >= VALIDATE_TXRESULT.Transaction.RefBlockNumber
      ) {
        VALIDATE_TXRESULT = await aelf.chain.getTxResult(VALIDATE_TXID);
        heightDone = true;
      }
    }

    console.log(VALIDATE_TXRESULT, "VALIDATE_TXRESULT=====2");

    const merklePath = await getMerklePathByTxId(aelf, VALIDATE_TXID);

    toast.update(validateNFTLoadingId, {
      render: "Validating NFT Successfully Executed",
      type: "success",
      isLoading: false,
    });
    removeNotification(validateNFTLoadingId);

    // return necessary values
    return {
      parentChainHeight: VALIDATE_TXRESULT.BlockNumber,
      signedTx: signedTx,
      merklePath: merklePath,
    };
  } catch (error) {
    console.log("error======", error);
    return "error";
  }
};

// step 8 - Create a NFT on SideChain.
const createNftTokenOnSideChain = async (values: INftValidateResult) => {
  try {
    const createSideChainNFTLoadingId = toast.loading(
      "Creating NFT on SideChain..."
    );

    const CROSS_CHAIN_CREATE_TOKEN_PARAMS = {
      fromChainId: mainchain_from_chain_id,
      parentChainHeight: values.parentChainHeight,
      transactionBytes: Buffer.from(values.signedTx, "hex").toString("base64"),
      merklePath: values.merklePath,
    };

    await sideChainSmartContract?.callSendMethod(
      "CrossChainCreateToken",
      currentWalletAddress,
      CROSS_CHAIN_CREATE_TOKEN_PARAMS
    );

    toast.update(createSideChainNFTLoadingId, {
      render: "NFT Created Successfully On SideChain",
      type: "success",
      isLoading: false,
    });
    removeNotification(createSideChainNFTLoadingId);
    return "success";
  } catch (error) {
    console.log("error====", error);
    return "error";
  }
};

// step 9 - Issue a NFT Function which has been Created on SideChain
const issueNftOnSideChain = async (values: {
  symbol: string;
  amount: string;
  memo: string;
}) => {
  try {
    const createSideChainNFTLoadingId = toast.loading(
      "Issuing NFT on SideChain..."
    );
    const issueNftInput = {
      symbol: values.symbol,
      amount: values.amount,
      memo: values.memo,
      to: currentWalletAddress,
    };
    const result = await sideChainSmartContract?.callSendMethod(
      "Issue",
      currentWalletAddress,
      issueNftInput
    );
    console.log("========= result of createNewNft =========", result);

    toast.update(createSideChainNFTLoadingId, {
      render: "NFT Issue Successfully Executed",
      type: "success",
      isLoading: false,
    });
    removeNotification(createSideChainNFTLoadingId);
    toast.success("You will get NFT on your Wallet! It can take sometimes to get into your wallet");
    handleReturnClick();
    return "success";
  } catch (error: any) {
    console.error(error.message, "=====error");
    toast.error(error.message);
    setTransactionStatus(false);
    return "error";
  }
};

// step 10 - Call Necessary Function for Create NFT
const createNftToken = async (values: INftParams) => {
  try {
    const mainChainResult = await createNFTOnMainChain(values);

    if (mainChainResult === "error") {
      setTransactionStatus(false);
      return;
    }
    await delay(3000);

    const validateNFTData: INftValidateResult | "error" = await validateNftToken(values);

    if (validateNFTData === "error") {
      setTransactionStatus(false);
      return;
    }

    const sideChainResult = await createNftTokenOnSideChain(validateNFTData);

    if (sideChainResult === "error") {
      setTransactionStatus(false);
      return;
    }

    await issueNftOnSideChain({
      symbol: values.symbol,
      amount: values.totalSupply,
      memo: "We are issuing nftToken",
    });
    setTransactionStatus(false);
  } catch (error: any) {
    console.error(error, "=====error");
    setTransactionStatus(false);
    toast.error(error);
    return "error";
  }
};
  //============== Handle Submit Form =================//

//Step 11 - Handle Submit Form
const onSubmit = async (values: z.infer<typeof formSchema>) => {
  setTransactionStatus(true);

  if (isNftCollectionCreated) {
    // Already Collection Created
    // create NFT Token
    await createNftToken(values);
  } else {
    // create NFT Collection on MainChain
    const createResult = await createNftCollectionOnMainChain(values);

    if (createResult === "error") {
      setTransactionStatus(false);
      return;
    }
    // Validate NFT Collection
    const validateCollectionResult = await validateNftCollectionInfo(
      createResult
    );

    if (validateCollectionResult === "error") {
      setTransactionStatus(false);
      return;
    }

    // create NFT Collection on SideChain
    await createCollectionOnSideChain(
      validateCollectionResult.transactionId,
      validateCollectionResult.signedTx,
      validateCollectionResult.BlockNumber
    );
  }
};

  return (
    <div className="form-wrapper">
      <div className="form-container">
        <div className="form-content">
          <h2 className="form-title">Create a New NFT</h2>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-8 proposal-form"
            >
              <div className="input-group">
                <FormField
                  control={form.control}
                  name="tokenName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Token Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="input-group">
                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                     <FormLabel className="symbol-label">Symbol <InfoIcon className="info-icon"/></FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Symbol" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="input-group">
                <FormField
                  control={form.control}
                  name="totalSupply"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Supply</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Total Supply" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {!isNftCollectionCreated && (
                <div className="input-group">
                  <FormField
                    control={form.control}
                    name="decimals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Decimals</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter Decimals" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <div className="button-container">
                <Button
                  type="button"
                  className="return-btn"
                  disabled={!!transactionStatus}
                  onClick={handleReturnClick}
                >
                  Return
                </Button>
                <Button
                  type="submit"
                  className="submit-btn"
                  disabled={!!transactionStatus}
                >
                  Create {isNftCollectionCreated ? "NFT" : "Collection"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default CreateNftPage;
