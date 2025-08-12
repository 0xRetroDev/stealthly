import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { BITE } from '@skalenetwork/bite';
import { Shield, Lock, Eye, Zap, TrendingUp, AlertCircle, CheckCircle, LogOut, Wallet, Twitter, MessageCircle, Github, Send } from 'lucide-react';
import TokenCard from './TokenCard.jsx';
import CreateTokenForm from './CreateTokenForm.jsx';
import TokenPreview from './TokenPreview.jsx';
import TransactionModal from './TransactionModal.jsx';
import TokensMarketplace from './TokensMarketplace.jsx';

const BITE_ENABLED = true;
const BITE_DEBUG_MODE = true;

const FACTORY_ABI = [
  "function createToken(string name, string symbol, string description, string imageUrl, uint256 initialBuyAmount) external payable returns (address token, address bondingCurve)",
  "function createTokenWithSocials(string name, string symbol, string description, string imageUrl, string website, string twitter, uint256 initialBuyAmount) external payable returns (address token, address bondingCurve)",
  "function getAllTokens() external view returns (address[] memory)",
  "function tokenToBondingCurve(address token) external view returns (address)",
  "function getBondingCurve(address token) external view returns (address)",
  "function tokenCreationFee() external view returns (uint256)",
  "function platformFeePercent() external view returns (uint256)",
  "function treasury() external view returns (address)"
];

const BONDING_CURVE_ABI = [
  "function buyTokens(uint256 minTokensOut) external payable",
  "function sellTokens(uint256 tokenAmount, uint256 minAvaxOut) external",
  "function previewBuy(uint256 avaxAmount) external view returns (uint256 tokensOut, uint256 newPrice, uint256 priceImpact, uint256 platformFee)",
  "function previewSell(uint256 tokenAmount) external view returns (uint256 avaxOut, uint256 netAvaxOut, uint256 sellFee, uint256 feeAmount)",
  "function getCurrentPrice() external view returns (uint256)",
  "function getTokenInfo() external view returns (uint256 tokensSold, uint256 avaxRaised, uint256 currentSellFee, bool graduated, uint256 progress)",
  "function token() external view returns (address)",
  "function graduated() external view returns (bool)"
];

const TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function getMetadata() external view returns (string description, string imageUrl, address creator, uint256 launchTime)",
  "function getSocialLinks() external view returns (string website, string twitter)"
];

const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS || "0xaF91835078a449927a949F42C0a29863F8d2bDa6";
const SKALE_ENDPOINT = import.meta.env.VITE_SKALE_ENDPOINT || "https://testnet-v1.skalenodes.com/v1/gifted-strong-minkar";

const validateSkaleEndpoint = async (endpoint) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'web3_clientVersion',
        params: [],
        id: 1
      })
    });
    
    const result = await response.json();
    console.log('SKALE endpoint validation result:', result);
    
    return response.ok && result.result;
  } catch (error) {
    console.error('SKALE endpoint validation failed:', error);
    return false;
  }
};

function TokenLaunchpad() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [networkName, setNetworkName] = useState('');
  
  const [biteInstance, setBiteInstance] = useState(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [biteStatus, setBiteStatus] = useState('disconnected');
  
  const [tokens, setTokens] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [platformFee, setPlatformFee] = useState('0');
  const [creationFee, setCreationFee] = useState('0');
  
  const [activeTab, setActiveTab] = useState('create');
  const [notification, setNotification] = useState(null);
  
  const [previewFormData, setPreviewFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    website: '',
    twitter: '',
    initialBuy: '0.1'
  });
  
  const [transactionModal, setTransactionModal] = useState({
    isOpen: false,
    type: '',
    data: null,
    status: 'loading',
    error: null
  });

  const initializeBiteEncryption = useCallback(async () => {
    if (!BITE_ENABLED) {
      setBiteStatus('error');
      setEncryptionEnabled(false);
      console.log('BITE is disabled via configuration');
      return;
    }

    setBiteStatus('connecting');
    
    try {
      console.log('Initializing BITE with endpoint:', SKALE_ENDPOINT);
      
      const isEndpointValid = await validateSkaleEndpoint(SKALE_ENDPOINT);
      if (!isEndpointValid) {
        throw new Error(`SKALE endpoint validation failed: ${SKALE_ENDPOINT}`);
      }
      
      const bite = new BITE(SKALE_ENDPOINT);
      
      if (BITE_DEBUG_MODE) {
        console.log('BITE Debug - Instance created:', {
          endpoint: SKALE_ENDPOINT,
          biteInstance: !!bite,
          bitePrototype: Object.getOwnPropertyNames(Object.getPrototypeOf(bite))
        });
      }
      
      console.log('Fetching BITE public key...');
      const publicKey = await bite.getCommonPublicKey();
      
      if (!publicKey || publicKey.length === 0) {
        throw new Error('Invalid public key received from BITE');
      }
      
      if (BITE_DEBUG_MODE) {
        console.log('BITE Debug - Public key details:', {
          length: publicKey.length,
          type: typeof publicKey,
          preview: Array.isArray(publicKey) ? `Array[${publicKey.length}]` : `${publicKey.slice(0, 20)}...`
        });
      }
      
      console.log('Testing BITE encryption capability...');
      const testTx = {
        to: '0x0000000000000000000000000000000000000000',
        data: '0x',
        value: '0x0',
        gasLimit: 500000
      };
      
      const testEncrypted = await bite.encryptTransaction(testTx);
      
      if (!testEncrypted || !testEncrypted.to || !testEncrypted.data) {
        throw new Error('BITE encryption test failed - invalid response structure');
      }
      
      if (BITE_DEBUG_MODE) {
        console.log('BITE Debug - Test encryption result:', {
          originalTo: testTx.to,
          encryptedTo: testEncrypted.to,
          isValidEthAddress: ethers.isAddress(testEncrypted.to),
          dataLengthChange: `${testTx.data.length} -> ${testEncrypted.data.length}`
        });
      }
      
      if (!ethers.isAddress(testEncrypted.to)) {
        console.warn('BITE returned non-standard address format:', testEncrypted.to);
      }
      
      setBiteInstance(bite);
      setEncryptionEnabled(true);
      setBiteStatus('connected');
      
      console.log('BITE encryption initialized successfully');
      console.log('Public key length:', publicKey.length);
      console.log('Test encryption successful, to address:', testEncrypted.to);
      
      showNotification('Encryption enabled - transactions will be private', 'success');
      
    } catch (error) {
      console.error('BITE initialization failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        endpoint: SKALE_ENDPOINT,
        biteEnabled: BITE_ENABLED
      });
      
      setBiteStatus('error');
      setEncryptionEnabled(false);
      
      let errorMessage = 'Encryption unavailable - transactions will be public';
      
      if (error.message.includes('endpoint validation failed')) {
        errorMessage = 'SKALE network unavailable - check your internet connection';
      } else if (error.message.includes('Invalid public key')) {
        errorMessage = 'BITE service not responding - encryption temporarily disabled';
      } else if (error.message.includes('encryption test failed')) {
        errorMessage = 'BITE encryption malfunction - using public transactions';
      }
      
      showNotification(errorMessage, 'warning');
      
      if (BITE_DEBUG_MODE) {
        console.log('BITE Troubleshooting Info:', {
          endpoint: SKALE_ENDPOINT,
          networkReachable: await validateSkaleEndpoint(SKALE_ENDPOINT).catch(() => false),
          biteLibraryAvailable: typeof BITE !== 'undefined',
          userAgent: navigator.userAgent,
          currentTime: new Date().toISOString()
        });
      }
    }
  }, []);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected. Please install MetaMask to continue.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.');
      }

      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setUserAddress(userAddress);
      setNetworkName(network.name);

      console.log('Wallet connected:', userAddress);
      console.log('Network:', network.name, network.chainId);

      await initializeBiteEncryption();
      await loadPlatformData(provider);
      
      showNotification('Wallet connected successfully', 'success');

    } catch (error) {
      console.error('Wallet connection failed:', error);
      showNotification(error.message, 'error');
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setUserAddress('');
    setNetworkName('');
    setTokens([]);
    setBiteInstance(null);
    setEncryptionEnabled(false);
    setBiteStatus('disconnected');
    
    showNotification('Wallet disconnected', 'success');
  };

  const toggleEncryption = () => {
    if (biteStatus === 'connected') {
      const newEncryptionState = !encryptionEnabled;
      setEncryptionEnabled(newEncryptionState);
      
      const newStatus = newEncryptionState ? 'enabled' : 'disabled';
      showNotification(`Encryption ${newStatus}`, 'success');
    } else {
      showNotification('Encryption not available', 'warning');
    }
  };

  const loadPlatformData = async (providerInstance) => {
    try {
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, providerInstance);
      
      const [creationFeeWei, platformFeePercent] = await Promise.all([
        factoryContract.tokenCreationFee(),
        factoryContract.platformFeePercent()
      ]);
      
      setCreationFee(ethers.formatEther(creationFeeWei));
      setPlatformFee(platformFeePercent.toString());
      
    } catch (error) {
      console.error('Failed to load platform data:', error);
    }
  };

  const loadTokensFromFactory = useCallback(async () => {
    if (!provider) return;
    
    setIsLoadingTokens(true);
    
    try {
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const tokenAddresses = await factoryContract.getAllTokens();
      
      console.log(`Loading ${tokenAddresses.length} tokens from factory`);
      
      const tokenDataPromises = tokenAddresses.map(async (tokenAddress) => {
        try {
          return await loadTokenData(tokenAddress);
        } catch (error) {
          console.error(`Failed to load token ${tokenAddress}:`, error);
          return null;
        }
      });
      
      const tokenData = await Promise.all(tokenDataPromises);
      const validTokens = tokenData.filter(token => token !== null);
      
      validTokens.sort((a, b) => b.launchTime - a.launchTime);
      
      setTokens(validTokens);
      console.log(`Loaded ${validTokens.length} valid tokens`);
      
    } catch (error) {
      console.error('Failed to load tokens:', error);
      showNotification('Failed to load tokens from contract', 'error');
    } finally {
      setIsLoadingTokens(false);
    }
  }, [provider]);

  const loadTokenData = async (tokenAddress) => {
    const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    
    const bondingCurveAddress = await factoryContract.tokenToBondingCurve(tokenAddress);
    const bondingCurveContract = new ethers.Contract(bondingCurveAddress, BONDING_CURVE_ABI, provider);
    
    const [
      name,
      symbol,
      metadata,
      tokenInfo,
      currentPrice,
      userBalance
    ] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.getMetadata(),
      bondingCurveContract.getTokenInfo(),
      bondingCurveContract.getCurrentPrice(),
      signer ? tokenContract.balanceOf(userAddress) : ethers.parseEther('0')
    ]);

    let socialLinks = { website: '', twitter: '' };
    try {
      const links = await tokenContract.getSocialLinks();
      socialLinks = {
        website: links[0] || '',
        twitter: links[1] || ''
      };
    } catch (error) {
      console.log('Social links not supported for token:', tokenAddress);
    }
    
    return {
      address: tokenAddress,
      bondingCurveAddress,
      name,
      symbol,
      description: metadata[0],
      imageUrl: metadata[1],
      creator: metadata[2],
      launchTime: Number(metadata[3]),
      website: socialLinks.website,
      twitter: socialLinks.twitter,
      tokensSold: tokenInfo[0],
      avaxRaised: tokenInfo[1],
      currentSellFee: tokenInfo[2],
      graduated: tokenInfo[3],
      progressToGraduation: tokenInfo[4],
      currentPrice,
      userBalance
    };
  };

  const handleFormDataUpdate = (formData) => {
    setPreviewFormData(formData);
  };

  const openTransactionModal = (type, data) => {
    setTransactionModal({
      isOpen: true,
      type,
      data,
      status: 'loading',
      error: null
    });
  };

  const updateTransactionModal = (status, error = null) => {
    setTransactionModal(prev => ({
      ...prev,
      status,
      error
    }));
  };

  const closeTransactionModal = () => {
    setTransactionModal({
      isOpen: false,
      type: '',
      data: null,
      status: 'loading',
      error: null
    });
  };

  const createToken = async (tokenData) => {
    if (!signer) {
      showNotification('Please connect your wallet first', 'error');
      return false;
    }

    openTransactionModal('create', tokenData);

    try {
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const initialBuyAmount = ethers.parseEther(tokenData.initialBuy);
      const creationFeeAmount = ethers.parseEther(creationFee);
      const totalValue = initialBuyAmount + creationFeeAmount;

      if (encryptionEnabled && biteInstance && BITE_ENABLED) {
        console.log('Creating encrypted token launch transaction');
        
        const transactionData = {
          to: FACTORY_ADDRESS,
          data: tokenData.website || tokenData.twitter 
            ? factoryContract.interface.encodeFunctionData("createTokenWithSocials", [
                tokenData.name,
                tokenData.symbol,
                tokenData.description,
                tokenData.imageUrl,
                tokenData.website || '',
                tokenData.twitter || '',
                initialBuyAmount
              ])
            : factoryContract.interface.encodeFunctionData("createToken", [
                tokenData.name,
                tokenData.symbol,
                tokenData.description,
                tokenData.imageUrl,
                initialBuyAmount
              ]),
          value: totalValue,
          gasLimit: 5000000
        };

        console.log('BEFORE ENCRYPTION - Original transaction:', transactionData);

        const encryptedTransaction = await biteInstance.encryptTransaction(transactionData);
        
        console.log('AFTER ENCRYPTION - Full encrypted object:', encryptedTransaction);
        console.log('AFTER ENCRYPTION - Data field specifically:', encryptedTransaction.data);
        console.log('AFTER ENCRYPTION - Data type:', typeof encryptedTransaction.data);
        console.log('AFTER ENCRYPTION - Data length:', encryptedTransaction.data?.length);

        // Create clean transaction object for sending
        const cleanTransaction = {
          to: encryptedTransaction.to,
          data: encryptedTransaction.data,
          value: encryptedTransaction.value,
          gasLimit: encryptedTransaction.gasLimit
        };

        console.log('SENDING TO METAMASK - Clean transaction:', cleanTransaction);

        const transaction = await signer.sendTransaction(cleanTransaction);
        
        await transaction.wait();
        
      } else {
        console.log('Creating public token launch transaction');
        
        let transaction;
        
        if (tokenData.website || tokenData.twitter) {
          try {
            transaction = await factoryContract.createTokenWithSocials(
              tokenData.name,
              tokenData.symbol,
              tokenData.description,
              tokenData.imageUrl,
              tokenData.website || '',
              tokenData.twitter || '',
              initialBuyAmount,
              { value: totalValue }
            );
          } catch (error) {
            console.log('Enhanced token creation not supported, falling back to basic creation');
            transaction = await factoryContract.createToken(
              tokenData.name,
              tokenData.symbol,
              tokenData.description,
              tokenData.imageUrl,
              initialBuyAmount,
              { value: totalValue }
            );
          }
        } else {
          transaction = await factoryContract.createToken(
            tokenData.name,
            tokenData.symbol,
            tokenData.description,
            tokenData.imageUrl,
            initialBuyAmount,
            { value: totalValue }
          );
        }
        
        const receipt = await transaction.wait();
        console.log('Public token creation confirmed:', receipt.transactionHash);
      }

      updateTransactionModal('success');

      setTimeout(() => {
        loadTokensFromFactory();
        closeTransactionModal();
      }, 3000);

      return true;

    } catch (error) {
      console.error('Token creation failed:', error);
      
      let errorMessage = 'Token creation failed';
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for transaction';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Transaction reverted - check your inputs and balance';
      } else if (error.message.includes('BITE encryption failed')) {
        errorMessage = 'Encryption failed - try disabling encryption';
      }
      
      updateTransactionModal('error', errorMessage);
      return false;
    }
  };

  const buyTokens = async (tokenData, purchaseAmount) => {
    if (!signer) {
      showNotification('Please connect your wallet first', 'error');
      return false;
    }

    openTransactionModal('buy', {
      tokenName: tokenData.name,
      tokenSymbol: tokenData.symbol,
      amount: purchaseAmount
    });

    try {
      const bondingCurveContract = new ethers.Contract(
        tokenData.bondingCurveAddress, 
        BONDING_CURVE_ABI, 
        signer
      );
      
      const purchaseAmountWei = ethers.parseEther(purchaseAmount);

      if (encryptionEnabled && biteInstance && BITE_ENABLED) {
        console.log('Creating encrypted buy transaction');
        
        const transactionData = {
          to: tokenData.bondingCurveAddress,
          data: bondingCurveContract.interface.encodeFunctionData("buyTokens", [0]),
          value: purchaseAmountWei,
          gasLimit: 500000
        };

        console.log('Buy transaction data before encryption:', {
          to: transactionData.to,
          dataLength: transactionData.data.length,
          value: transactionData.value.toString(),
          gasLimit: transactionData.gasLimit
        });

        const encryptedTransaction = await biteInstance.encryptTransaction(transactionData);
        
        console.log('Encrypted buy transaction received:', {
          to: encryptedTransaction?.to,
          dataLength: encryptedTransaction?.data?.length,
          value: encryptedTransaction?.value,
          gasLimit: encryptedTransaction?.gasLimit
        });

        if (!encryptedTransaction || !encryptedTransaction.data || encryptedTransaction.data === '0x' || encryptedTransaction.data === '') {
          throw new Error('BITE encryption failed - no transaction data returned');
        }

        console.log('Sending encrypted buy transaction');
        const transaction = await signer.sendTransaction(encryptedTransaction);
        
        await transaction.wait();
        
      } else {
        console.log('Creating public buy transaction');
        
        const transaction = await bondingCurveContract.buyTokens(0, {
          value: purchaseAmountWei
        });
        
        await transaction.wait();
      }

      updateTransactionModal('success');

      setTimeout(() => {
        loadTokensFromFactory();
        closeTransactionModal();
      }, 2000);

      return true;

    } catch (error) {
      console.error('Token purchase failed:', error);
      
      let errorMessage = 'Token purchase failed';
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for purchase';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Transaction reverted - check token availability';
      } else if (error.message.includes('BITE encryption failed')) {
        errorMessage = 'Encryption failed - try disabling encryption';
      }
      
      updateTransactionModal('error', errorMessage);
      return false;
    }
  };

  const sellTokens = async (tokenData, sellAmount) => {
    if (!signer) {
      showNotification('Please connect your wallet first', 'error');
      return false;
    }

    const expectedFair = (parseFloat(sellAmount) * parseFloat(ethers.formatEther(tokenData.currentPrice))).toFixed(4);
    openTransactionModal('sell', {
      tokenName: tokenData.name,
      tokenSymbol: tokenData.symbol,
      tokenAmount: sellAmount,
      expectedFair: expectedFair
    });

    try {
      const bondingCurveContract = new ethers.Contract(
        tokenData.bondingCurveAddress, 
        BONDING_CURVE_ABI, 
        signer
      );
      
      const tokenContract = new ethers.Contract(tokenData.address, TOKEN_ABI, signer);
      const sellAmountWei = ethers.parseEther(sellAmount);

      const allowance = await tokenContract.allowance(userAddress, tokenData.bondingCurveAddress);
      if (allowance < sellAmountWei) {
        const approveTransaction = await tokenContract.approve(tokenData.bondingCurveAddress, sellAmountWei);
        await approveTransaction.wait();
      }

      if (encryptionEnabled && biteInstance && BITE_ENABLED) {
        console.log('Creating encrypted sell transaction');
        
        const transactionData = {
          to: tokenData.bondingCurveAddress,
          data: bondingCurveContract.interface.encodeFunctionData("sellTokens", [sellAmountWei, 0]),
          value: 0,
          gasLimit: 500000
        };

        console.log('Sell transaction data before encryption:', {
          to: transactionData.to,
          dataLength: transactionData.data.length,
          value: transactionData.value,
          gasLimit: transactionData.gasLimit
        });

        const encryptedTransaction = await biteInstance.encryptTransaction(transactionData);
        
        console.log('Encrypted sell transaction received:', {
          to: encryptedTransaction?.to,
          dataLength: encryptedTransaction?.data?.length,
          value: encryptedTransaction?.value,
          gasLimit: encryptedTransaction?.gasLimit
        });

        if (!encryptedTransaction || !encryptedTransaction.data || encryptedTransaction.data === '0x' || encryptedTransaction.data === '') {
          throw new Error('BITE encryption failed - no transaction data returned');
        }

        console.log('Sending encrypted sell transaction');
        const transaction = await signer.sendTransaction(encryptedTransaction);
        
        await transaction.wait();
        
      } else {
        console.log('Creating public sell transaction');
        
        const transaction = await bondingCurveContract.sellTokens(sellAmountWei, 0);
        
        await transaction.wait();
      }

      updateTransactionModal('success');

      setTimeout(() => {
        loadTokensFromFactory();
        closeTransactionModal();
      }, 2000);

      return true;

    } catch (error) {
      console.error('Token sale failed:', error);
      
      let errorMessage = 'Token sale failed';
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient balance for sale';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Transaction reverted - check token balance';
      } else if (error.message.includes('BITE encryption failed')) {
        errorMessage = 'Encryption failed - try disabling encryption';
      }
      
      updateTransactionModal('error', errorMessage);
      return false;
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    if (provider) {
      loadTokensFromFactory();
    }
  }, [provider, loadTokensFromFactory]);

  return (
    <div className="token-launchpad">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <div className="logo">
                <h1 className="logo-title">STEALTHLY</h1>
                <span className="network-badge">SECURE BY DESIGN</span>
              </div>
            </div>
          </div>
          
          <div className="header-right">
            {userAddress && (
              <div 
                className="encryption-toggle"
                data-tooltip={
                  biteStatus === 'connected'
                    ? (encryptionEnabled 
                        ? 'Your transactions are encrypted' 
                        : 'Your transactions are visible to MEV bots')
                    : 'Encryption not available'
                }
              >
                <span className="toggle-label">Private Transactions</span>
                <button
                  className={`toggle-button ${encryptionEnabled ? 'active' : ''}`}
                  onClick={toggleEncryption}
                  disabled={biteStatus !== 'connected'}
                  title={
                    biteStatus === 'connected'
                      ? (encryptionEnabled ? 'Encryption enabled' : 'Encryption disabled')
                      : 'Encryption not available'
                  }
                >
                  <div className="toggle-slider" />
                </button>
                {encryptionEnabled ? <Lock className="encryption-icon" /> : <Eye className="encryption-icon" />}
              </div>
            )}
            
            {userAddress ? (
              <div className="wallet-section">
                <div className="wallet-info">
                  <Wallet className="wallet-icon" />
                  <div className="wallet-address">
                    {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                  </div>
                </div>
                <button 
                  className="disconnect-button-icon" 
                  onClick={disconnectWallet}
                  title="Disconnect Wallet"
                >
                  <LogOut className="disconnect-icon" />
                </button>
              </div>
            ) : (
              <button className="connect-wallet-button" onClick={connectWallet}>
                <Wallet className="wallet-icon" />
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <TransactionModal
        isOpen={transactionModal.isOpen}
        onClose={closeTransactionModal}
        transactionType={transactionModal.type}
        transactionData={transactionModal.data}
        isEncrypted={encryptionEnabled}
        status={transactionModal.status}
        error={transactionModal.error}
      />

      <main className="main-content">
        <div className="content-container">
          
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              <Zap className="tab-icon" />
              Create Token
            </button>
            <button
              className={`tab-button ${activeTab === 'trade' ? 'active' : ''}`}
              onClick={() => setActiveTab('trade')}
            >
              <TrendingUp className="tab-icon" />
              Trade Tokens
            </button>
          </div>

          {activeTab === 'create' && (
            <div className="tab-content">
              <div className="create-tab-layout">
                <div className="create-form-section">
                  <CreateTokenForm
                    onCreateToken={createToken}
                    onFormDataUpdate={handleFormDataUpdate}
                    creationFee={creationFee}
                    platformFee={platformFee}
                    encryptionEnabled={encryptionEnabled}
                    isConnected={!!signer}
                  />
                </div>
                <div className="create-preview-section">
                  <TokenPreview
                    formData={previewFormData}
                    encryptionEnabled={encryptionEnabled}
                    isConnected={!!signer}
                    platformFee={platformFee}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trade' && (
            <div className="tab-content">
              <TokensMarketplace 
                tokens={tokens}
                isLoadingTokens={isLoadingTokens}
                onRefresh={loadTokensFromFactory}
                onBuyTokens={buyTokens}
                onSellTokens={sellTokens}
                encryptionEnabled={encryptionEnabled}
                isConnected={!!signer}
                provider={provider}
                platformFee={platformFee}
              />
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <h2 className="footer-logo-title">STEALTHLY</h2>
            </div>
            <p className="footer-tagline">
              Launch tokens with MEV protection on SKALE
            </p>
            <p className="footer-description">
              Create, trade, and manage tokens with advanced encryption technology. 
              Built on SKALE Network for zero gas fees and lightning-fast transactions.
            </p>
            <div className="footer-social">
              <a href="#" className="footer-social-link" title="Twitter">
                <Twitter className="footer-social-icon" />
              </a>
              <a href="#" className="footer-social-link" title="Discord">
                <MessageCircle className="footer-social-icon" />
              </a>
              <a href="#" className="footer-social-link" title="GitHub">
                <Github className="footer-social-icon" />
              </a>
              <a href="#" className="footer-social-link" title="Telegram">
                <Send className="footer-social-icon" />
              </a>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Technology</h4>
            <div className="footer-links">
              <a target='_blank' href="https://skale.space/blog/introducing-bite-protocol-the-end-of-mev-and-the-dawn-of-blockchain-privacy" className="footer-link">BITE Encryption</a>
              <a target='_blank' href="https://www.fairchain.ai/" className="footer-link">FAIR Chain</a>
              <a target='_blank' href="https://docs.skale.space/welcome/get-started" className="footer-link">Documentation</a>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Support</h4>
            <div className="footer-links">
              <a target='_blank' href="mailto:hello@0xretro.dev" className="footer-link">Contact Us</a>
              <a target='_blank' href="https://github.com/0xRetroDev" className="footer-link">Bug Reports</a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="footer-copyright">
            © 2025 STEALTHLY. Built on SKALE Network.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default TokenLaunchpad;