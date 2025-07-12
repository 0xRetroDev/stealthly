import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { Search, TrendingUp, RefreshCw, X, TrendingDown, Copy, Check } from 'lucide-react';
import TokenCard from './TokenCard.jsx';
import '../TokensMarketplace.css';

/**
 * Enhanced Tokens Marketplace Component
 */
function TokensMarketplace({ 
  tokens, 
  isLoadingTokens, 
  onRefresh, 
  onBuyTokens, 
  onSellTokens, 
  encryptionEnabled, 
  isConnected, 
  provider 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('volume'); // 'volume', 'new', 'progress'
  const [selectedToken, setSelectedToken] = useState(null);
  const [quickBuyAmounts, setQuickBuyAmounts] = useState({});
  const [copiedTokenAddress, setCopiedTokenAddress] = useState(null);


  /**
   * Format token amounts for display
   */
  const formatTokenAmount = (amount) => {
    try {
      if (!amount) return '0';
      const amountStr = typeof amount === 'bigint' ? amount.toString() : amount.toString();
      const formatted = ethers.formatEther(amountStr);
      const number = parseFloat(formatted);
      
      if (number >= 1e6) {
        return (number / 1e6).toFixed(1) + 'M';
      } else if (number >= 1e3) {
        return (number / 1e3).toFixed(1) + 'K';
      } else {
        return number.toFixed(2);
      }
    } catch (error) {
      return '0';
    }
  };

  /**
   * Get volume (amount raised) for sorting
   */
  const getVolume = (token) => {
    try {
      return parseFloat(ethers.formatEther(token.avaxRaised || '0'));
    } catch (error) {
      return 0;
    }
  };

  /**
   * Get progress percentage
   */
  const getProgress = (token) => {
    try {
      return Math.min((Number(token.progressToGraduation) / 100), 100);
    } catch (error) {
      return 0;
    }
  };

  /**
   * Check if search term matches token address or name
   */
  const matchesSearch = (token, term) => {
    if (!term.trim()) return true;
    
    const searchLower = term.toLowerCase();
    
    // Check if it matches the full contract address
    if (token.address && token.address.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Check if it matches name or symbol
    return (
      token.name.toLowerCase().includes(searchLower) ||
      token.symbol.toLowerCase().includes(searchLower)
    );
  };

  /**
   * Filter and sort tokens
   */
  const processedTokens = useMemo(() => {
    let filtered = tokens;

    // Apply search filter (supports contract address, name, symbol)
    if (searchTerm.trim()) {
      filtered = filtered.filter(token => matchesSearch(token, searchTerm));
    }

    // Sort tokens
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return getVolume(b) - getVolume(a);
        case 'new':
          return b.launchTime - a.launchTime;
        case 'progress':
          return getProgress(b) - getProgress(a);
        default:
          return getVolume(b) - getVolume(a);
      }
    });

    return sorted;
  }, [tokens, searchTerm, sortBy]);

  /**
   * Get top 3 tokens by volume with enhanced data
   */
  const topTokens = useMemo(() => {
    return [...tokens]
      .filter(token => !token.graduated && getVolume(token) > 0)
      .sort((a, b) => getVolume(b) - getVolume(a))
      .slice(0, 3)
      .map((token, index) => ({
        ...token,
        rank: index + 1,
        volume: getVolume(token),
        progress: getProgress(token)
      }));
  }, [tokens]);

  /**
   * Handle quick buy
   */
  const handleQuickBuy = (token) => {
    const amount = quickBuyAmounts[token.address] || '0.1';
    onBuyTokens(token, amount);
  };

  /**
   * Update quick buy amount
   */
  const updateQuickBuyAmount = (tokenAddress, amount) => {
    setQuickBuyAmounts(prev => ({
      ...prev,
      [tokenAddress]: amount
    }));
  };

  if (isLoadingTokens) {
    return (
      <div className="marketplace-loading">
        <RefreshCw className="loading-spinner-marketplace" />
        <p>Loading tokens...</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="marketplace-empty">
        <h3>No Wallet Connected</h3>
        <p>Please connect your wallet to view tokens.</p>
      </div>
    );
  }

  return (
    <div className="tokens-marketplace-clean">
      {/* Enhanced Top Performers Section */}
{topTokens.length > 0 && (
  <div className="top-performers">
    <div className="section-header">
      <h2>🚀 TOP PERFORMERS</h2>
      <p>Leading tokens ranked by trading volume</p>
    </div>
    
    <div className="top-tokens-grid">
      {topTokens.map((token) => (
        <div key={token.address} className={`top-token-card rank-${token.rank}`}>
          <div className="rank">#{token.rank}</div>
          
          <div className="token-info top-performer">
            <div className="token-avatar">
              {token.imageUrl ? (
                <img src={token.imageUrl} alt={token.name} />
              ) : (
                <div className="avatar-placeholder">{token.symbol.charAt(0)}</div>
              )}
            </div>
<div className="token-details">
  <h4>{token.name}</h4>
  <span className="symbol">${token.symbol}</span>

  <div className="top-token-address">
    <code className="address-text">
      {token.address.slice(0, 6)}...{token.address.slice(-4)}
    </code>
    <button
      className={`copy-button ${copiedTokenAddress === token.address ? 'copied' : ''}`}
      onClick={() => {
        navigator.clipboard.writeText(token.address);
        setCopiedTokenAddress(token.address);
        setTimeout(() => setCopiedTokenAddress(null), 2000);
      }}
      title={copiedTokenAddress === token.address ? 'Copied!' : 'Copy contract address'}
    >
      {copiedTokenAddress === token.address ? <Check size={14} /> : <Copy size={14} />}
    </button>
  </div>
</div>

          </div>

          {/* Smaller FAIR Raised Metric */}
          <div className="fair-raised-metric">
            <div className="fair-raised-label">Total Raised</div>
            <div className="fair-raised-amount">
              {formatTokenAmount(token.avaxRaised)} FAIR
            </div>
          </div>

          {/* Enhanced Quick Buy */}
          <div className="quick-buy-section">
            <div className="amount-input">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10"
                value={quickBuyAmounts[token.address] || '0.1'}
                onChange={(e) => updateQuickBuyAmount(token.address, e.target.value)}
                placeholder="0.1"
              />
              <span className="currency">FAIR</span>
            </div>
            <button
              className="quick-buy-btn"
              onClick={() => handleQuickBuy(token)}
              disabled={!isConnected || token.graduated}
            >
              Quick Buy
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

      {/* Minimal Search and Controls */}
      <div className="marketplace-controls">
        <div className="controls-header">
          <h2>All Tokens ({processedTokens.length})</h2>
        </div>

        <div className="controls-row">
          {/* Minimal Search Bar */}
          <div className="minimal-search">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, symbol, or contract address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search" onClick={() => setSearchTerm('')}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Compact Controls */}
          <div className="compact-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="volume">Top Volume</option>
              <option value="new">Newest</option>
              <option value="progress">Most Progress</option>
            </select>
            
            <button 
              className="refresh-btn"
              onClick={onRefresh}
              disabled={isLoadingTokens}
              title="Refresh tokens"
            >
              <RefreshCw className={isLoadingTokens ? 'spinning' : ''} size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Token Grid */}
      <div className="tokens-grid-clean">
        {processedTokens.length === 0 ? (
          <div className="no-results">
            <p>No tokens found matching "{searchTerm}"</p>
            <button onClick={() => setSearchTerm('')}>Clear search</button>
          </div>
        ) : (
          processedTokens.map((token) => (
            <TokenCard
              key={token.address}
              token={token}
              onBuyTokens={onBuyTokens}
              onSellTokens={onSellTokens}
              encryptionEnabled={encryptionEnabled}
              isConnected={isConnected}
              provider={provider}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default TokensMarketplace;