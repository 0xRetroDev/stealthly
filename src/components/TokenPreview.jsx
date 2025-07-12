import React from 'react';
import { User, Clock, TrendingUp, CheckCircle, Eye, Lock, ExternalLink, Twitter, Calculator } from 'lucide-react';

/**
 * Token Preview Component
 * Shows a real-time preview of how the token card will look
 */
function TokenPreview({ formData, encryptionEnabled, isConnected }) {
  /**
   * Format token amounts for display
   */
  const formatTokenAmount = (amount) => {
    try {
      if (!amount) return '0';
      const number = parseFloat(amount);
      
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
      return '0';
    }
  };

  /**
   * Get mock progress percentage
   */
  const getMockProgress = () => {
    // Show some progress based on initial buy amount
    const initialBuy = parseFloat(formData.initialBuy) || 0;
    return Math.min((initialBuy * 10), 100);
  };

  /**
   * Check if preview should show as complete
   */
  const isPreviewComplete = () => {
    return formData.name.trim() && 
           formData.symbol.trim() && 
           formData.description.trim() && 
           formData.initialBuy && 
           parseFloat(formData.initialBuy) >= 0;
  };

  // Safe defaults for preview
  const previewData = {
    name: formData.name || 'Your Token Name',
    symbol: formData.symbol || 'SYMBOL',
    description: formData.description || 'Enter a description for your token...',
    imageUrl: formData.imageUrl || '',
    creator: isConnected ? '0x1234...5678' : '0x0000...0000',
    initialBuy: formData.initialBuy || '0.1',
    website: formData.website || '',
    twitter: formData.twitter || ''
  };

  /**
   * Get project links that have values
   */
  const getProjectLinks = () => {
    const links = [];
    
    if (previewData.website) {
      links.push({
        type: 'website',
        url: previewData.website,
        icon: ExternalLink,
        label: 'Website'
      });
    }
    
    if (previewData.twitter) {
      links.push({
        type: 'twitter',
        url: previewData.twitter,
        icon: Twitter,
        label: 'X (Twitter)'
      });
    }
    
    return links;
  };

  return (
    <div className="token-preview-container">
      <div className="preview-header">
        <h3>Token Preview</h3>
        <p>This is how your token will appear to other users</p>
        
        {/* Preview Status */}
        <div className={`preview-status ${isPreviewComplete() ? 'complete' : 'incomplete'}`}>
          {isPreviewComplete() ? (
            <>
              <CheckCircle className="status-icon" />
              <span>Ready to Launch</span>
            </>
          ) : (
            <>
              <Clock className="status-icon" />
              <span>Fill out form to preview</span>
            </>
          )}
        </div>
      </div>

      {/* Token Card Preview */}
      <div className={`token-card preview-card ${!isPreviewComplete() ? 'incomplete' : ''}`}>
        {/* Token Header */}
        <div className="token-header">
          <div className="token-image-container">
            {previewData.imageUrl ? (
              <img
                src={previewData.imageUrl}
                alt={`${previewData.name} logo`}
                className="token-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="token-image-placeholder" 
              style={{ display: previewData.imageUrl ? 'none' : 'flex' }}
            >
              {previewData.symbol.charAt(0) || '?'}
            </div>
          </div>
          
          <div className="token-info">
            <div className="token-title">
              <h3 className="token-name">{previewData.name}</h3>
              <span className="token-symbol">${previewData.symbol}</span>
            </div>
          </div>
        </div>

        {/* Token Description */}
        <p className="token-description">
          {previewData.description}
        </p>

        {/* Project Links */}
        {getProjectLinks().length > 0 && (
          <div className="token-project-links">
            {getProjectLinks().map((link, index) => {
              const IconComponent = link.icon;
              return (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="project-link"
                  title={link.label}
                  onClick={(e) => e.preventDefault()} // Prevent navigation in preview
                >
                  <IconComponent className="project-link-icon" />
                  <span className="project-link-label">{link.label}</span>
                </a>
              );
            })}
          </div>
        )}

        {/* Token Metadata */}
        <div className="token-metadata">
          <div className="metadata-item">
            <User className="metadata-icon" />
            <span className="metadata-label">Creator:</span>
            <span className="metadata-value">
              {previewData.creator}
            </span>
          </div>
          
          <div className="metadata-item">
            <Clock className="metadata-icon" />
            <span className="metadata-label">Launched:</span>
            <span className="metadata-value">Just now</span>
            
          </div>

        <div className="metadata-item">
            <Calculator className="metadata-icon" />
            <span className="metadata-label">Sell Fee:</span>
            <span className="metadata-value">1.00%</span>
            
          </div>
        </div>

        {/* Token Statistics */}
        <div className="token-stats">
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-label">Price</span>
              <span className="stat-value">0.000001 FAIR</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Raised</span>
              <span className="stat-value">{previewData.initialBuy} FAIR</span>
            </div>
          </div>
          
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-label">Tokens Sold</span>
              <span className="stat-value">{formatTokenAmount(parseFloat(previewData.initialBuy) * 1000000)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Your Balance</span>
              <span className="stat-value">{formatTokenAmount(parseFloat(previewData.initialBuy) * 1000000)}</span>
            </div>
          </div>
        </div>

        {/* Progress to Graduation */}
        <div className="graduation-progress">
          <div className="progress-header">
            <span className="progress-label">Progress to Graduation</span>
            <span className="progress-percentage">{getMockProgress().toFixed(1)}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${getMockProgress()}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button
            className={`action-button buy-button ${encryptionEnabled ? 'encrypted' : 'public'}`}
            disabled={true}
          >
            {encryptionEnabled ? (
              <>
                <Lock className="button-icon" />
                <span>Buy {previewData.symbol}</span>
              </>
            ) : (
              <>
                <Eye className="button-icon" />
                <span>Buy {previewData.symbol}</span>
              </>
            )}
          </button>

          <button
            className={`action-button sell-button disabled`}
            disabled={true}
          >
            <TrendingUp className="button-icon" />
            <span>SELL {previewData.symbol}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TokenPreview;