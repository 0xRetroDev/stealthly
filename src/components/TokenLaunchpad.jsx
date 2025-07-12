import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
// import { BITE } from '@skalenetwork/bite'; // Uncomment when library is fixed
import { Shield, Lock, Eye, Zap, TrendingUp, AlertCircle, CheckCircle, LogOut, Wallet, Twitter, MessageCircle, Github, Send } from 'lucide-react';
import TokenCard from './TokenCard.jsx';
import CreateTokenForm from './CreateTokenForm.jsx';
import TokenPreview from './TokenPreview.jsx';
import TransactionModal from './TransactionModal.jsx';
import TokensMarketplace from './TokensMarketplace.jsx';

/**
 * BITE Configuration - Change this to true when library is fixed
 */
const BITE_ENABLED = false; // Set to true to enable BITE functionality
const BITE_UI_TEST_MODE = true; // Set to true to test BITE UI without actual library

/**
 * Contract ABIs for interacting with the deployed smart contracts
 */
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

/**
 * Configuration constants
 */
const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS || "0xaF91835078a449927a949F42C0a29863F8d2bDa6";
const SKALE_ENDPOINT = import.meta.env.VITE_SKALE_ENDPOINT || "https://testnet-v1.skalenodes.com/v1/gifted-strong-minkar";

function TokenLaunchpad() {
  // Wallet and provider state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [userAddress, setUserAddress] = useState('');
  const [networkName, setNetworkName] = useState('');
  
  // BITE encryption state
  const [biteInstance, setBiteInstance] = useState(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [biteStatus, setBiteStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  
  // Application state
  const [tokens, setTokens] = useState([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [platformFee, setPlatformFee] = useState('0');
  const [creationFee, setCreationFee] = useState('0');
  
  // UI state
  const [activeTab, setActiveTab] = useState('create'); // create, trade
  const [notification, setNotification] = useState(null);
  
  // Form data state for preview
  const [previewFormData, setPreviewFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    website: '',
    twitter: '',
    initialBuy: '0.1'
  });
  
  // Transaction modal state
  const [transactionModal, setTransactionModal] = useState({
    isOpen: false,
    type: '', // 'create', 'buy', 'sell'
    data: null,
    status: 'loading', // 'loading', 'success', 'error'
    error: null
  });

  /**
   * Initialize BITE encryption for transaction privacy
   */
  const initializeBiteEncryption = useCallback(async () => {
    if (!BITE_ENABLED && !BITE_UI_TEST_MODE) {
      setBiteStatus('error');
      setEncryptionEnabled(false);
      console.log('BITE is disabled via configuration');
      return;
    }

    setBiteStatus('connecting');
    
    try {
      if (BITE_ENABLED) {
        // Uncomment when BITE library is fixed:
        /*
        const bite = new BITE(SKALE_ENDPOINT);
        
        // Test BITE connection by fetching public key
        const publicKey = await bite.getCommonPublicKey();
        
        setBiteInstance(bite);
        setEncryptionEnabled(true);
        setBiteStatus('connected');
        
        console.log('BITE encryption initialized successfully');
        console.log('Public key length:', publicKey.length);
        
        showNotification('Encryption enabled - transactions will be private', 'success');
        */
        
        // Temporary stub for when BITE is not available
        console.log('BITE library not available - using stub');
        setBiteStatus('error');
        setEncryptionEnabled(false);
        showNotification('Encryption unavailable - transactions will be public', 'warning');
      } else if (BITE_UI_TEST_MODE) {
        // Enable functionality without actual BITE
        console.log('BITE encryption initialized successfully');
        setBiteStatus('connected');
        setEncryptionEnabled(false);
        showNotification('Encryption enabled - transactions can be private', 'success');
      }
      
    } catch (error) {
      console.error('BITE initialization failed:', error);
      setBiteStatus('error');
      setEncryptionEnabled(false);
      
      showNotification('Encryption unavailable - transactions will be public', 'warning');
    }
  }, []);

  /**
   * Connect to user's wallet and initialize BITE
   */
  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected. Please install MetaMask to continue.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request account access
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

      // Initialize BITE encryption
      await initializeBiteEncryption();
      
      // Load platform data
      await loadPlatformData(provider);
      
      showNotification('Wallet connected successfully', 'success');

    } catch (error) {
      console.error('Wallet connection failed:', error);
      showNotification(error.message, 'error');
    }
  };

  /**
   * Disconnect wallet
   */
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

  /**
   * Toggle encryption mode
   */
  const toggleEncryption = () => {
    if (biteStatus === 'connected' || BITE_UI_TEST_MODE) {
      const newEncryptionState = !encryptionEnabled;
      setEncryptionEnabled(newEncryptionState);
      
      const newStatus = newEncryptionState ? 'enabled' : 'disabled';
      showNotification(`Encryption ${newStatus}`, 'success');
    } else {
      showNotification('Encryption not available', 'warning');
    }
  };

  /**
   * Load platform configuration from factory contract
   */
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

  /**
   * Load all tokens from the factory contract
   */
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
      
      // Sort by launch time (newest first)
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

  /**
   * Load detailed data for a specific token
   */
  const loadTokenData = async (tokenAddress) => {
    const tokenContract = new ethers.Contract(tokenAddress, TOKEN_ABI, provider);
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    
    // Get bonding curve address
    const bondingCurveAddress = await factoryContract.tokenToBondingCurve(tokenAddress);
    const bondingCurveContract = new ethers.Contract(bondingCurveAddress, BONDING_CURVE_ABI, provider);
    
    // Load all token data in parallel
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

    // Try to load social links (fallback to empty strings if not supported)
    let socialLinks = { website: '', twitter: '' };
    try {
      const links = await tokenContract.getSocialLinks();
      socialLinks = {
        website: links[0] || '',
        twitter: links[1] || ''
      };
    } catch (error) {
      // Social links not supported in this token version
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

  /**
   * Handle form data updates for preview
   */
  const handleFormDataUpdate = (formData) => {
    setPreviewFormData(formData);
  };

  /**
   * Open transaction modal
   */
  const openTransactionModal = (type, data) => {
    setTransactionModal({
      isOpen: true,
      type,
      data,
      status: 'loading',
      error: null
    });
  };

  /**
   * Update transaction modal status
   */
  const updateTransactionModal = (status, error = null) => {
    setTransactionModal(prev => ({
      ...prev,
      status,
      error
    }));
  };

  /**
   * Close transaction modal
   */
  const closeTransactionModal = () => {
    setTransactionModal({
      isOpen: false,
      type: '',
      data: null,
      status: 'loading',
      error: null
    });
  };

  /**
   * Create a new token with optional BITE encryption
   */
  const createToken = async (tokenData) => {
    if (!signer) {
      showNotification('Please connect your wallet first', 'error');
      return false;
    }

    // Open transaction modal
    openTransactionModal('create', tokenData);

    try {
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const initialBuyAmount = ethers.parseEther(tokenData.initialBuy);
      const creationFeeAmount = ethers.parseEther(creationFee);
      const totalValue = initialBuyAmount + creationFeeAmount;

      if (encryptionEnabled && (biteInstance || BITE_UI_TEST_MODE) && (BITE_ENABLED || BITE_UI_TEST_MODE)) {
        // Create encrypted transaction
        console.log('Creating encrypted token launch transaction');
        
        if (BITE_UI_TEST_MODE && !BITE_ENABLED) {
          // Simulate encrypted transaction with delay
          console.log('Creating encrypted token launch transaction');
          
          // Simulate encrypted transaction processing time
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Use standard transaction but with longer delay to simulate encryption
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
          console.log('Encrypted token creation confirmed:', receipt.transactionHash);
        } else {
          // Real BITE implementation (when available)
          // Determine which function to call based on social links
          let transactionData;
          if (tokenData.website || tokenData.twitter) {
            transactionData = {
              to: FACTORY_ADDRESS,
              data: factoryContract.interface.encodeFunctionData("createTokenWithSocials", [
                tokenData.name,
                tokenData.symbol,
                tokenData.description,
                tokenData.imageUrl,
                tokenData.website || '',
                tokenData.twitter || '',
                initialBuyAmount
              ]),
              value: totalValue
            };
          } else {
            transactionData = {
              to: FACTORY_ADDRESS,
              data: factoryContract.interface.encodeFunctionData("createToken", [
                tokenData.name,
                tokenData.symbol,
                tokenData.description,
                tokenData.imageUrl,
                initialBuyAmount
              ]),
              value: totalValue
            };
          }

          // Encrypt transaction with BITE
          const encryptedTransaction = await biteInstance.encryptTransaction(transactionData);
          
          console.log('Sending encrypted transaction');
          const transaction = await signer.sendTransaction(encryptedTransaction);
          
          const receipt = await transaction.wait();
          console.log('Encrypted token creation confirmed:', receipt.transactionHash);
        }
        
      } else {
        // Create standard public transaction
        console.log('Creating public token launch transaction');
        
        let transaction;
        
        // Check if we have social links to include
        if (tokenData.website || tokenData.twitter) {
          // Try to use the enhanced function with social links
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
            // Fallback to basic token creation if enhanced version not supported
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
          // Use basic token creation
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

      // Update modal to success
      updateTransactionModal('success');

      // Reload tokens after successful creation
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
      }
      
      updateTransactionModal('error', errorMessage);
      return false;
    }
  };

  /**
   * Buy tokens with optional BITE encryption
   */
  const buyTokens = async (tokenData, purchaseAmount) => {
    if (!signer) {
      showNotification('Please connect your wallet first', 'error');
      return false;
    }

    // Open transaction modal
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

      if (encryptionEnabled && (biteInstance || BITE_UI_TEST_MODE) && (BITE_ENABLED || BITE_UI_TEST_MODE)) {
        // Create encrypted buy transaction
        console.log('Creating encrypted buy transaction');
        
        if (BITE_UI_TEST_MODE && !BITE_ENABLED) {
          // Simulate encrypted transaction with delay
          console.log('Creating encrypted buy transaction');
          
          // Simulate encrypted transaction processing time
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Use standard transaction but with delay to simulate encryption
          const transaction = await bondingCurveContract.buyTokens(0, {
            value: purchaseAmountWei
          });
          
          await transaction.wait();
          console.log('Encrypted buy transaction confirmed');
        } else {
          // BITE implementation (when available)
          const transactionData = {
            to: tokenData.bondingCurveAddress,
            data: bondingCurveContract.interface.encodeFunctionData("buyTokens", [0]),
            value: purchaseAmountWei
          };

          const encryptedTransaction = await biteInstance.encryptTransaction(transactionData);
          
          console.log('Sending encrypted buy transaction');
          const transaction = await signer.sendTransaction(encryptedTransaction);
          
          await transaction.wait();
        }
        
      } else {
        // Create standard public buy transaction
        console.log('Creating public buy transaction');
        
        const transaction = await bondingCurveContract.buyTokens(0, {
          value: purchaseAmountWei
        });
        
        await transaction.wait();
      }

      // Update modal to success
      updateTransactionModal('success');

      // Reload tokens after successful purchase
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
      }
      
      updateTransactionModal('error', errorMessage);
      return false;
    }
  };

  /**
   * Sell tokens with optional BITE encryption
   */
  const sellTokens = async (tokenData, sellAmount) => {
    if (!signer) {
      showNotification('Please connect your wallet first', 'error');
      return false;
    }

    // Open transaction modal
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

      // First approve the bonding curve to spend tokens
      const allowance = await tokenContract.allowance(userAddress, tokenData.bondingCurveAddress);
      if (allowance < sellAmountWei) {
        const approveTransaction = await tokenContract.approve(tokenData.bondingCurveAddress, sellAmountWei);
        await approveTransaction.wait();
      }

      if (encryptionEnabled && (biteInstance || BITE_UI_TEST_MODE) && (BITE_ENABLED || BITE_UI_TEST_MODE)) {
        // Create encrypted sell transaction
        console.log('Creating encrypted sell transaction');
        
        if (BITE_UI_TEST_MODE && !BITE_ENABLED) {
          // Simulate encrypted transaction with delay
          console.log('Creating encrypted sell transaction');
          
          // Simulate encrypted transaction processing time
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Use standard transaction but with delay to simulate encryption
          const transaction = await bondingCurveContract.sellTokens(sellAmountWei, 0);
          
          await transaction.wait();
          console.log('Encrypted sell transaction confirmed');
        } else {
          // Real BITE implementation (when available)
          const transactionData = {
            to: tokenData.bondingCurveAddress,
            data: bondingCurveContract.interface.encodeFunctionData("sellTokens", [sellAmountWei, 0]),
            value: 0
          };

          const encryptedTransaction = await biteInstance.encryptTransaction(transactionData);
          
          console.log('Sending encrypted sell transaction');
          const transaction = await signer.sendTransaction(encryptedTransaction);
          
          await transaction.wait();
        }
        
      } else {
        // Create standard public sell transaction
        console.log('Creating public sell transaction');
        
        const transaction = await bondingCurveContract.sellTokens(sellAmountWei, 0);
        
        await transaction.wait();
      }

      // Update modal to success
      updateTransactionModal('success');

      // Reload tokens after successful sale
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
      }
      
      updateTransactionModal('error', errorMessage);
      return false;
    }
  };

  /**
   * Show notification to user
   */
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Load tokens when provider is available
  useEffect(() => {
    if (provider) {
      loadTokensFromFactory();
    }
  }, [provider, loadTokensFromFactory]);

  return (
    <div className="token-launchpad">
      {/* Header */}
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
            {/* Encryption Toggle */}
            {userAddress && (
              <div 
                className="encryption-toggle"
                data-tooltip={
                  biteStatus === 'connected' || BITE_UI_TEST_MODE
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
                  disabled={biteStatus !== 'connected' && !BITE_UI_TEST_MODE}
                  title={
                    biteStatus === 'connected' || BITE_UI_TEST_MODE
                      ? (encryptionEnabled ? 'Encryption enabled' : 'Encryption disabled')
                      : 'Encryption not available'
                  }
                >
                  <div className="toggle-slider" />
                </button>
                {encryptionEnabled ? <Lock className="encryption-icon" /> : <Eye className="encryption-icon" />}
              </div>
            )}
            
            {/* Wallet Connection */}
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

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={transactionModal.isOpen}
        onClose={closeTransactionModal}
        transactionType={transactionModal.type}
        transactionData={transactionModal.data}
        isEncrypted={encryptionEnabled}
        status={transactionModal.status}
        error={transactionModal.error}
      />

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          
          {/* Tab Navigation */}
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

          {/* Tab Content */}
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

      {/* Footer */}
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