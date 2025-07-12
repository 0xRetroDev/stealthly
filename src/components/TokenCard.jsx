import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Lock, Eye, ShoppingCart, TrendingUp, TrendingDown, User, Clock, CheckCircle, DollarSign, ExternalLink, Twitter, Calculator, Copy, Check } from 'lucide-react';

// Bonding Curve ABI for preview functions
const BONDING_CURVE_ABI = [
  "function previewBuy(uint256 avaxAmount) external view returns (uint256 tokensOut, uint256 newPrice, uint256 priceImpact, uint256 platformFee)",
  "function previewSell(uint256 tokenAmount) external view returns (uint256 avaxOut, uint256 netAvaxOut, uint256 sellFee, uint256 feeAmount)"
];

function TokenCard({ token, onBuyTokens, onSellTokens, encryptionEnabled, isConnected, provider }) {
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [buyAmount, setBuyAmount] = useState('0.1');
  const [sellAmount, setSellAmount] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [contractCopied, setContractCopied] = useState(false);
  
  // Preview state
  const [buyPreview, setBuyPreview] = useState({
    tokensOut: '0',
    newPrice: '0',
    priceImpact: '0',
    platformFee: '0'
  });
  const [sellPreview, setSellPreview] = useState({
    avaxOut: '0',
    netAvaxOut: '0',
    sellFee: '0',
    feeAmount: '0'
  });

  // Safe defaults for token data with proper BigInt handling
  const safeToken = {
    name: 'Unknown Token',
    symbol: 'UNK',
    description: '',
    imageUrl: '',
    website: '',
    twitter: '',
    creator: '0x0000000000000000000000000000000000000000',
    launchTime: 0,
    tokensSold: '0',
    avaxRaised: '0',
    currentSellFee: 0,
    graduated: false,
    progressToGraduation: 0,
    currentPrice: '0',
    userBalance: '0',
    ...token,
    // Ensure BigInt values are properly handled
    userBalance: token?.userBalance || '0',
    currentPrice: token?.currentPrice || '0',
    tokensSold: token?.tokensSold || '0',
    avaxRaised: token?.avaxRaised || '0',
    // Ensure social links are included
    website: token?.website || '',
    twitter: token?.twitter || ''
  };

  const formatTokenAmount = (amount) => {
    try {
      if (!amount) return '0';
      // Handle BigInt properly
      const amountStr = typeof amount === 'bigint' ? amount.toString() : amount.toString();
      const formatted = ethers.formatEther(amountStr);
      const number = parseFloat(formatted);
      
      if (number >= 1e9) {
        return (number / 1e9).toFixed(1) + 'B';
      } else if (number >= 1e6) {
        return (number / 1e6).toFixed(1) + 'M';
      } else if (number >= 1e3) {
        return (number / 1e3).toFixed(1) + 'K';
      } else {
        return number.toFixed(2);
      }
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return '0';
    }
  };

  const formatEthAmount = (amount) => {
    try {
      if (!amount) return '0';
      // Handle BigInt properly
      const amountStr = typeof amount === 'bigint' ? amount.toString() : amount.toString();
      const formatted = ethers.formatEther(amountStr);
      const number = parseFloat(formatted);
      return number.toFixed(4);
    } catch (error) {
      console.error('Error formatting ETH amount:', error);
      return '0';
    }
  };

  const formatPrice = (price) => {
    try {
      if (!price) return '0.000000';

      const priceStr = typeof price === 'bigint' ? price.toString() : price.toString();
      const formatted = ethers.formatEther(priceStr);

      // Keep up to 10 decimal places, trim trailing zeroes
      const fixed = Number(formatted).toLocaleString('en-US', {
        minimumFractionDigits: 6,
        maximumFractionDigits: 10,
        useGrouping: false
      });

      return fixed;
    } catch (error) {
      console.error('Error formatting price:', error);
      return '0.000000';
    }
  };

  const getProgressPercentage = () => {
    try {
      return Math.min((Number(safeToken.progressToGraduation) / 100), 100);
    } catch (error) {
      console.error('Error calculating progress:', error);
      return 0;
    }
  };

  const getTimeSinceLaunch = () => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - (safeToken.launchTime || 0);
      
      if (elapsed < 60) {
        return `${elapsed}s ago`;
      } else if (elapsed < 3600) {
        return `${Math.floor(elapsed / 60)}m ago`;
      } else if (elapsed < 86400) {
        return `${Math.floor(elapsed / 3600)}h ago`;
      } else {
        return `${Math.floor(elapsed / 86400)}d ago`;
      }
    } catch (error) {
      console.error('Error calculating time since launch:', error);
      return 'Unknown';
    }
  };

  const hasTokensToSell = () => {
    try {
      if (!safeToken.userBalance) return false;
      // Handle BigInt properly
      const balanceStr = typeof safeToken.userBalance === 'bigint' 
        ? safeToken.userBalance.toString() 
        : safeToken.userBalance.toString();
      const balance = parseFloat(ethers.formatEther(balanceStr));
      return balance > 0;
    } catch (error) {
      console.error('Error checking token balance:', error);
      return false;
    }
  };

  /**
   * Copy contract address to clipboard
   */
  const copyContractAddress = async () => {
    try {
      await navigator.clipboard.writeText(safeToken.address);
      setContractCopied(true);
      setTimeout(() => setContractCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy contract address:', error);
    }
  };

  /**
   * Format contract address for display
   */
  const formatContractAddress = (address) => {
    if (!address) return '0x0000...0000';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Get project links that should always be displayed
   */
  const getProjectLinks = () => {
    const links = [
      {
        type: 'website',
        url: safeToken.website,
        icon: ExternalLink,
        label: 'Website',
        available: !!safeToken.website
      },
      {
        type: 'twitter',
        url: safeToken.twitter,
        icon: Twitter,
        label: 'X (Twitter)',
        available: !!safeToken.twitter
      }
    ];
    
    return links;
  };

  const updateBuyPreview = async (amount) => {
    if (!provider || !amount || parseFloat(amount) <= 0) {
      setBuyPreview({
        tokensOut: '0',
        newPrice: '0',
        priceImpact: '0',
        platformFee: '0'
      });
      return;
    }

    try {
      const bondingCurveContract = new ethers.Contract(
        safeToken.bondingCurveAddress, 
        BONDING_CURVE_ABI, 
        provider
      );
      
      const amountWei = ethers.parseEther(amount);
      const preview = await bondingCurveContract.previewBuy(amountWei);
      
      setBuyPreview({
        tokensOut: preview[0].toString(),
        newPrice: preview[1].toString(),
        priceImpact: preview[2].toString(),
        platformFee: preview[3].toString()
      });
    } catch (error) {
      console.error('Error getting buy preview:', error);
      setBuyPreview({
        tokensOut: '0',
        newPrice: '0',
        priceImpact: '0',
        platformFee: '0'
      });
    }
  };

  const updateSellPreview = async (amount) => {
    if (!provider || !amount || parseFloat(amount) <= 0) {
      setSellPreview({
        avaxOut: '0',
        netAvaxOut: '0',
        sellFee: '0',
        feeAmount: '0'
      });
      return;
    }

    try {
      const bondingCurveContract = new ethers.Contract(
        safeToken.bondingCurveAddress, 
        BONDING_CURVE_ABI, 
        provider
      );
      
      const amountWei = ethers.parseEther(amount);
      const preview = await bondingCurveContract.previewSell(amountWei);
      
      setSellPreview({
        avaxOut: preview[0].toString(),
        netAvaxOut: preview[1].toString(),
        sellFee: preview[2].toString(),
        feeAmount: preview[3].toString()
      });
    } catch (error) {
      console.error('Error getting sell preview:', error);
      setSellPreview({
        avaxOut: '0',
        netAvaxOut: '0',
        sellFee: '0',
        feeAmount: '0'
      });
    }
  };

  // Update previews when amounts change
  useEffect(() => {
    if (showBuyModal) {
      updateBuyPreview(buyAmount);
    }
  }, [buyAmount, showBuyModal, provider, safeToken.bondingCurveAddress]);

  useEffect(() => {
    if (showSellModal) {
      updateSellPreview(sellAmount);
    }
  }, [sellAmount, showSellModal, provider, safeToken.bondingCurveAddress]);

  const handleBuyClick = () => {
    if (!isConnected) {
      alert('Please connect your wallet to buy tokens');
      return;
    }
    setShowBuyModal(true);
  };

  const handleSellClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isConnected) {
      alert('Please connect your wallet to sell tokens');
      return;
    }
    if (!hasTokensToSell()) {
      alert('You do not have any tokens to sell');
      return;
    }
    
    setShowSellModal(true);
  };

  const handleBuySubmit = async () => {
    const amount = parseFloat(buyAmount);
    
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid buy amount');
      return;
    }
    
    if (amount > 10) {
      const confirmed = window.confirm(
        `You are about to buy ${amount} FAIR worth of tokens. This is a large amount. Continue?`
      );
      if (!confirmed) return;
    }
    
    setIsBuying(true);
    
    // Close this modal immediately when transaction starts
    setShowBuyModal(false);
    setBuyAmount('0.1');
    
    try {
      await onBuyTokens(safeToken, buyAmount);
    } catch (error) {
      console.error('Buy failed:', error);
    } finally {
      setIsBuying(false);
    }
  };

  const handleSellSubmit = async () => {
    const amount = parseFloat(sellAmount);
    
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid sell amount');
      return;
    }
    
    // Check if they have enough tokens
    if (!hasTokensToSell()) {
      alert('You do not have any tokens to sell');
      return;
    }
    
    setIsSelling(true);
    
    // Close this modal immediately when transaction starts
    setShowSellModal(false);
    setSellAmount('');
    
    try {
      await onSellTokens(safeToken, sellAmount);
    } catch (error) {
      console.error('Sell failed:', error);
    } finally {
      setIsSelling(false);
    }
  };

  return (
    <>
      <div className="token-card">
        {/* Token Header */}
        <div className="token-header">
          <div className="token-image-container">
            {safeToken.imageUrl ? (
              <img
                src={safeToken.imageUrl}
                alt={`${safeToken.name} logo`}
                className="token-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="token-image-placeholder" 
              style={{ display: safeToken.imageUrl ? 'none' : 'flex' }}
            >
              {safeToken.symbol.charAt(0)}
            </div>
          </div>
          
          <div className="token-info">
            <div className="token-title">
              <h3 className="token-name">{safeToken.name}</h3>
              <span className="token-symbol">${safeToken.symbol}</span>
            </div>
            
            {safeToken.graduated && (
              <div className="graduated-badge">
                <CheckCircle className="graduated-icon" />
                <span>Graduated</span>
              </div>
            )}
          </div>
        </div>

        {/* Token Description */}
        {safeToken.description && (
          <p className="token-description">{safeToken.description}</p>
        )}

        {/* Project Links - Always Show All Links */}
        <div className="token-project-links">
          {getProjectLinks().map((link, index) => {
            const IconComponent = link.icon;
            return (
              <a
                key={index}
                href={link.available ? link.url : '#'}
                target={link.available ? "_blank" : "_self"}
                rel={link.available ? "noopener noreferrer" : ""}
                className={`project-link ${link.available ? 'available' : 'disabled'}`}
                title={link.available ? link.label : `${link.label} not provided`}
                onClick={link.available ? undefined : (e) => e.preventDefault()}
              >
                <IconComponent className="project-link-icon" />
                <span className="project-link-label">{link.label}</span>
              </a>
            );
          })}
        </div>

        {/* Token Metadata */}
        <div className="token-metadata">
          <div className="metadata-item">
            <User className="metadata-icon" />
            <span className="metadata-label">Creator:</span>
            <span className="metadata-value">
              {safeToken.creator.slice(0, 6)}...{safeToken.creator.slice(-4)}
            </span>
          </div>
          
          <div className="metadata-item">
            <Clock className="metadata-icon" />
            <span className="metadata-label">Launched:</span>
            <span className="metadata-value">{getTimeSinceLaunch()}</span>
          </div>

          {/* Contract Address - NEW */}
          <div className="metadata-item">
            <DollarSign className="metadata-icon" />
            <span className="metadata-label">Contract:</span>
            <span className="metadata-value">
              {formatContractAddress(safeToken.address)}
              <button
                className={`copy-button ${contractCopied ? 'copied' : ''}`}
                onClick={copyContractAddress}
                title={contractCopied ? 'Copied!' : 'Copy contract address'}
              >
                {contractCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </span>
          </div>

          <div className="metadata-item">
            <Calculator className="metadata-icon" />
            <span className="metadata-label">Sell Fee:</span>
            <span className="metadata-value">{(Number(safeToken.currentSellFee) / 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Token Statistics */}
        <div className="token-stats">
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-label">Price (FAIR)</span>
              <span className="stat-value">{formatPrice(safeToken.currentPrice)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Raised</span>
              <span className="stat-value">{formatEthAmount(safeToken.avaxRaised)} FAIR</span>
            </div>
          </div>
          
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-label">Tokens Sold</span>
              <span className="stat-value">{formatTokenAmount(safeToken.tokensSold)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Your Balance</span>
              <span className="stat-value">{formatTokenAmount(safeToken.userBalance)}</span>
            </div>
          </div>
        </div>

        {/* Progress to Graduation */}
        <div className="graduation-progress">
          <div className="progress-header">
            <span className="progress-label">Progress to Graduation</span>
            <span className="progress-percentage">{getProgressPercentage().toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className={`action-button buy-button ${safeToken.graduated ? 'disabled' : encryptionEnabled ? 'encrypted' : 'public'}`}
            onClick={handleBuyClick}
            disabled={safeToken.graduated || !isConnected}
          >
            {safeToken.graduated ? (
              <>
                <CheckCircle className="button-icon" />
                <span>Graduated</span>
              </>
            ) : encryptionEnabled ? (
              <>
                <Lock className="button-icon" />
                <span>Buy {safeToken.symbol}</span>
              </>
            ) : (
              <>
                <Eye className="button-icon" />
                <span>Buy {safeToken.symbol}</span>
              </>
            )}
          </button>

          <button
            className={`action-button sell-button ${!hasTokensToSell() || safeToken.graduated ? 'disabled' : encryptionEnabled ? 'encrypted' : 'public'}`}
            onClick={handleSellClick}
            disabled={!hasTokensToSell() || safeToken.graduated || !isConnected}
          >
            {!hasTokensToSell() ? (
              <>
                <TrendingDown className="button-icon" />
                <span>No Tokens</span>
              </>
            ) : safeToken.graduated ? (
              <>
                <CheckCircle className="button-icon" />
                <span>Graduated</span>
              </>
            ) : encryptionEnabled ? (
              <>
                <Lock className="button-icon" />
                <span>Sell {safeToken.symbol}</span>
              </>
            ) : (
              <>
                <Eye className="button-icon" />
                <span>Sell {safeToken.symbol}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Buy Modal */}
      {showBuyModal && (
        <div className="modal-overlay" onClick={() => setShowBuyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Buy {safeToken.symbol} Tokens</h3>
              <button 
                className="modal-close"
                onClick={() => setShowBuyModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Purchase Amount Input */}
              <div className="form-group">
                <label className="form-label">Purchase Amount (FAIR)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  max="100"
                  className="form-input"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="0.1"
                />
              </div>

              {/* Purchase Preview */}
              <div className="purchase-preview">
                <h4>Purchase Preview</h4>
                <div className="preview-item">
                  <span>You pay:</span>
                  <span>{buyAmount || '0'} FAIR</span>
                </div>
                <div className="preview-item">
                  <span>You receive:</span>
                  <span>{formatTokenAmount(buyPreview.tokensOut)} {safeToken.symbol}</span>
                </div>
                <div className="preview-item">
                  <span>New price:</span>
                  <span>{formatPrice(buyPreview.newPrice)} FAIR</span>
                </div>
                <div className="preview-item">
                  <span>Price impact:</span>
                  <span>{(Number(buyPreview.priceImpact) / 100).toFixed(2)}%</span>
                </div>
                <div className="preview-item">
                  <span>Platform fee:</span>
                  <span>{formatEthAmount(buyPreview.platformFee)} FAIR</span>
                </div>
              </div>

              {/* Encryption Notice */}
              {encryptionEnabled ? (
                <div className="encryption-notice success">
                  <Lock className="notice-icon" />
                  <div className="notice-content">
                    <strong>Private Transaction</strong>
                    <p>Your purchase will be encrypted and protected from MEV</p>
                  </div>
                </div>
              ) : (
                <div className="encryption-notice warning">
                  <Eye className="notice-icon" />
                  <div className="notice-content">
                    <strong>Public Transaction</strong>
                    <p>Your purchase will be visible and may be subject to front-running</p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowBuyModal(false)}
                disabled={isBuying}
              >
                Cancel
              </button>
              <button
                className={`confirm-button ${encryptionEnabled ? 'encrypted' : 'public'}`}
                onClick={handleBuySubmit}
                disabled={isBuying || !buyAmount || parseFloat(buyAmount) <= 0}
              >
                {isBuying ? (
                  'Processing...'
                ) : encryptionEnabled ? (
                  <>
                    <Lock className="button-icon" />
                    Buy {safeToken.symbol}
                  </>
                ) : (
                  <>
                    <ShoppingCart className="button-icon" />
                    Buy {safeToken.symbol}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {showSellModal && (
        <div className="modal-overlay" onClick={() => setShowSellModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sell {safeToken.symbol} Tokens</h3>
              <button 
                className="modal-close"
                onClick={() => setShowSellModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Sell Amount Input */}
              <div className="form-group">
                <label className="form-label">
                  Tokens to Sell
                  <span className="balance-info">
                    Balance: {formatTokenAmount(safeToken.userBalance)} {safeToken.symbol}
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="Enter amount to sell"
                />
              </div>

              {/* Sell Preview */}
              <div className="purchase-preview">
                <h4>Sell Preview</h4>
                <div className="preview-item">
                  <span>You sell:</span>
                  <span>{sellAmount || '0'} {safeToken.symbol}</span>
                </div>
                <div className="preview-item">
                  <span>You receive (gross):</span>
                  <span>{formatEthAmount(sellPreview.avaxOut)} FAIR</span>
                </div>
                <div className="preview-item">
                  <span>You receive (net):</span>
                  <span>{formatEthAmount(sellPreview.netAvaxOut)} FAIR</span>
                </div>
                <div className="preview-item warning">
                  <span>Sell fee:</span>
                  <span>{(Number(sellPreview.sellFee) / 100).toFixed(2)}%</span>
                </div>
                <div className="preview-item warning">
                  <span>Fee amount:</span>
                  <span>{formatEthAmount(sellPreview.feeAmount)} FAIR</span>
                </div>
              </div>

              {/* Encryption Notice */}
              {encryptionEnabled ? (
                <div className="encryption-notice success">
                  <Lock className="notice-icon" />
                  <div className="notice-content">
                    <strong>Private Transaction</strong>
                    <p>Your sale will be encrypted and protected from MEV</p>
                  </div>
                </div>
              ) : (
                <div className="encryption-notice warning">
                  <Eye className="notice-icon" />
                  <div className="notice-content">
                    <strong>Public Transaction</strong>
                    <p>Your sale will be visible and may be subject to front-running</p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowSellModal(false)}
                disabled={isSelling}
              >
                Cancel
              </button>
              <button
                className={`confirm-button ${encryptionEnabled ? 'encrypted' : 'public'}`}
                onClick={handleSellSubmit}
                disabled={isSelling || !sellAmount || parseFloat(sellAmount) <= 0}
              >
                {isSelling ? (
                  'Processing...'
                ) : encryptionEnabled ? (
                  <>
                    <Lock className="button-icon" />
                    Sell Privately
                  </>
                ) : (
                  <>
                    <TrendingDown className="button-icon" />
                    Sell Publicly
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TokenCard;