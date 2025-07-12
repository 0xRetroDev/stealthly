import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Eye, EyeOff, Shield, Bot } from 'lucide-react';

/**
 * Transaction Modal Component
 * Handles loading states, success/error feedback, and MEV bot simulation
 */
function TransactionModal({ 
  isOpen, 
  onClose, 
  transactionType, // 'create', 'buy', 'sell'
  transactionData, 
  isEncrypted, 
  status, // 'loading', 'success', 'error'
  error 
}) {
  const [showMevSimulation, setShowMevSimulation] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);

  // Reset simulation when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowMevSimulation(false);
      setSimulationStep(0);
    }
  }, [isOpen]);

  // Auto-start MEV simulation after a delay
  useEffect(() => {
    if (isOpen && status === 'loading') {
      const timer = setTimeout(() => {
        setShowMevSimulation(true);
        startMevSimulation();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, status]);

  const startMevSimulation = () => {
    const steps = isEncrypted ? 2 : 4;
    let step = 0;
    
    const interval = setInterval(() => {
      step++;
      setSimulationStep(step);
      
      if (step >= steps) {
        clearInterval(interval);
      }
    }, 800);
  };

  const getTransactionTitle = () => {
    switch (transactionType) {
      case 'create': return 'Creating Token';
      case 'buy': return 'Buying Tokens';
      case 'sell': return 'Selling Tokens';
      default: return 'Processing Transaction';
    }
  };

  const getSuccessTitle = () => {
    switch (transactionType) {
      case 'create': return 'Token Created Successfully!';
      case 'buy': return 'Tokens Purchased Successfully!';
      case 'sell': return 'Tokens Sold Successfully!';
      default: return 'Transaction Successful!';
    }
  };

  const getTransactionDetails = () => {
    if (!transactionData) return null;

    switch (transactionType) {
      case 'create':
        return (
          <div className="transaction-details">
            <div className="detail-item">
              <span>Token Name:</span>
              <span>{transactionData.name}</span>
            </div>
            <div className="detail-item">
              <span>Symbol:</span>
              <span>${transactionData.symbol}</span>
            </div>
            <div className="detail-item">
              <span>Initial Buy:</span>
              <span>{transactionData.initialBuy} FAIR</span>
            </div>
          </div>
        );
      case 'buy':
        return (
          <div className="transaction-details">
            <div className="detail-item">
              <span>Token:</span>
              <span>{transactionData.tokenName} (${transactionData.tokenSymbol})</span>
            </div>
            <div className="detail-item">
              <span>Amount:</span>
              <span>{transactionData.amount} FAIR</span>
            </div>
          </div>
        );
      case 'sell':
        return (
          <div className="transaction-details">
            <div className="detail-item">
              <span>Token:</span>
              <span>{transactionData.tokenName} (${transactionData.tokenSymbol})</span>
            </div>
            <div className="detail-item">
              <span>Tokens to Sell:</span>
              <span>{transactionData.tokenAmount}</span>
            </div>
            <div className="detail-item">
              <span>Expected FAIR:</span>
              <span>{transactionData.expectedFair} FAIR</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getMevSimulationData = () => {
    if (!transactionData) return [];

    const baseData = [
      { label: 'Transaction Type', value: transactionType.toUpperCase(), sensitive: true },
    ];

    // Add calldata information based on transaction type
    let calldataInfo = [];
    switch (transactionType) {
      case 'create':
        calldataInfo = [
          { label: 'Function', value: 'createToken()', sensitive: true },
          { label: 'Token Name', value: transactionData.name, sensitive: true },
          { label: 'Token Symbol', value: transactionData.symbol, sensitive: true },
          { label: 'Description', value: transactionData.description?.slice(0, 30) + '...', sensitive: true },
          { label: 'Initial Liquidity', value: `${transactionData.initialBuy} FAIR`, sensitive: true },
          { label: 'Creator Address', value: '0x1234...5678', sensitive: true }
        ];
        break;
      case 'buy':
        calldataInfo = [
          { label: 'Function', value: 'buyTokens()', sensitive: true },
          { label: 'Token Address', value: '0xabcd...ef01', sensitive: true },
          { label: 'Buy Amount', value: `${transactionData.amount} FAIR`, sensitive: true },
          { label: 'Slippage', value: '0.5%', sensitive: true }
        ];
        break;
      case 'sell':
        calldataInfo = [
          { label: 'Function', value: 'sellTokens()', sensitive: true },
          { label: 'Token Address', value: '0xabcd...ef01', sensitive: true },
          { label: 'Sell Amount', value: transactionData.tokenAmount, sensitive: true },
          { label: 'Sell Fee', value: '1.0%', sensitive: true }
        ];
        break;
      default:
        break;
    }

    return [...baseData, ...calldataInfo];
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay transaction-modal-overlay">
      <div className="modal-content transaction-modal">
        {/* Loading State */}
        {status === 'loading' && (
          <>
            <div className="modal-header">
              <h3>{getTransactionTitle()}</h3>
            </div>

            <div className="modal-body">
              <div className="loading-section">
                <div className="loading-spinner">
                  <div className="spinner"></div>
                </div>
                <p className="loading-text">
                  {isEncrypted ? 'Encrypting and processing transaction...' : 'Processing transaction...'}
                </p>
              </div>

              {getTransactionDetails()}

              {/* Calldata Preview Section */}
              <div className="calldata-preview">
                <h4>Transaction Data Preview</h4>
                <p className="calldata-description">
                  {isEncrypted 
                    ? 'This is what your transaction data looks like:'
                    : 'This is what your transaction data looks like:'
                  }
                </p>
                <div className="calldata-container">
                  <div className="calldata-label">Function Call:</div>
                  <code className="calldata-value">
                    {transactionType === 'create' && 'createToken(string,string,string,string,uint256)'}
                    {transactionType === 'buy' && 'buyTokens(uint256)'}
                    {transactionType === 'sell' && 'sellTokens(uint256,uint256)'}
                  </code>
                  
                  <div className="calldata-label">Parameters:</div>
                  <div className="calldata-params">
                    {transactionType === 'create' && (
                      <>
                        <div>name: "{transactionData.name}"</div>
                        <div>symbol: "{transactionData.symbol}"</div>
                        <div>description: "{transactionData.description?.slice(0, 50)}..."</div>
                        <div>
  imageUrl: "
  {transactionData.imageUrl
    ? `${transactionData.imageUrl.slice(0, 30)}${transactionData.imageUrl.length > 40 ? '...' : ''}`
    : 'empty'}
  "
</div>
                        <div>initialBuy: {transactionData.initialBuy} FAIR</div>
                      </>
                    )}
                    {transactionType === 'buy' && (
                      <>
                        <div>tokenAmount: {transactionData.amount} FAIR</div>
                      </>
                    )}
                    {transactionType === 'sell' && (
                      <>
                        <div>tokenAmount: {transactionData.tokenAmount}</div>
                      </>
                    )}
                  </div>
                  
                  {!isEncrypted && (
                    <div className="calldata-warning">
                      This data is visible to bots and can be front-run
                    </div>
                  )}
                  
                  {isEncrypted && (
                    <div className="calldata-success">
                      This data is encrypted and hidden from MEV bots
                    </div>
                  )}
                </div>
              </div>

              {/* MEV Bot Simulation */}
              {showMevSimulation && (
                <div className="mev-simulation">
                  <div className="simulation-header">
                    <Bot className="bot-icon" />
                    <h4>MEV Bot Simulation</h4>
                  </div>
                  
                  <div className="simulation-content">
                    <div className="bot-scanner">
                      <div className="scanner-line"></div>
                      <p>Scanning mempool for profitable opportunities...</p>
                    </div>

                    <div className="data-visibility">
                      {getMevSimulationData().map((item, index) => (
                        <div 
                          key={index} 
                          className={`data-item ${
                            isEncrypted && item.sensitive ? 'hidden' : 'visible'
                          } ${simulationStep > index ? 'revealed' : ''}`}
                        >
                          <span className="data-label">{item.label}:</span>
                          <span className="data-value">
                            {isEncrypted && item.sensitive ? '████████' : item.value}
                          </span>
                          {isEncrypted && item.sensitive && (
                            <EyeOff className="hidden-icon" />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="bot-decision">
                      {simulationStep >= (isEncrypted ? 2 : 4) && (
                        <div className={`decision ${isEncrypted ? 'no-attack' : 'attack-possible'}`}>
                          {isEncrypted ? (
                            <>
                              <CheckCircle className="decision-icon" />
                              <p><strong>No Front-Running Detected</strong></p>
                              <p>MEV bot cannot extract value - insufficient data</p>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="decision-icon" />
                              <p><strong>Front-Running Opportunity Detected</strong></p>
                              <p>Bots will be able to front-run this transaction</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Success State */}
        {status === 'success' && (
          <>
            <div className="modal-header success">
              <CheckCircle className="success-icon" />
              <h3>{getSuccessTitle()}</h3>
            </div>

            <div className="modal-body">
              {getTransactionDetails()}

              <div className="success-message">
                <p>
                  {isEncrypted 
                    ? 'Your transaction was completed successfully!'
                    : 'Your transaction was completed successfully!'
                  }
                </p>
              </div>

              <div className="success-actions">
                <button 
                  className="action-button primary"
                  onClick={onClose}
                >
                  Continue Trading
                </button>
              </div>
            </div>
          </>
        )}

        {/* Error State */}
        {status === 'error' && (
          <>
            <div className="modal-header error">
              <AlertCircle className="error-icon" />
              <h3>Transaction Failed</h3>
            </div>

            <div className="modal-body">
              <div className="error-details">
                <p className="error-message">{error || 'An unexpected error occurred'}</p>
              </div>

              <div className="error-actions">
                <button 
                  className="action-button secondary"
                  onClick={onClose}
                >
                  Try Again
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TransactionModal;