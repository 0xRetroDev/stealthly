import React, { useState, useEffect } from 'react';
import { Lock, Eye, AlertTriangle, ExternalLink, Twitter } from 'lucide-react';

/**
 * Form component for creating new tokens
 * Handles form validation and submission
 */
function CreateTokenForm({ onCreateToken, onFormDataUpdate, creationFee, encryptionEnabled, isConnected }) {
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    website: '',
    twitter: '',
    initialBuy: '0.1'
  });
  
  const [validationErrors, setValidationErrors] = useState({});

  // Update parent component with form data changes for preview
  useEffect(() => {
    if (onFormDataUpdate) {
      onFormDataUpdate(formData);
    }
  }, [formData, onFormDataUpdate]);

  /**
   * Handle form input changes
   */
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const errors = {};
    
    // Token name validation
    if (!formData.name.trim()) {
      errors.name = 'Token name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Token name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Token name must not exceed 50 characters';
    }
    
    // Token symbol validation
    if (!formData.symbol.trim()) {
      errors.symbol = 'Token symbol is required';
    } else if (formData.symbol.length < 2) {
      errors.symbol = 'Token symbol must be at least 2 characters';
    } else if (formData.symbol.length > 10) {
      errors.symbol = 'Token symbol must not exceed 10 characters';
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol)) {
      errors.symbol = 'Token symbol must contain only uppercase letters and numbers';
    }
    
    // Description validation - NOW REQUIRED
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 500) {
      errors.description = 'Description must not exceed 500 characters';
    }
    
    // Image URL validation
    if (formData.imageUrl && !isValidUrl(formData.imageUrl)) {
      errors.imageUrl = 'Please enter a valid URL';
    }
    
    // Website URL validation
    if (formData.website && !isValidUrl(formData.website)) {
      errors.website = 'Please enter a valid website URL';
    }
    
    // Twitter URL validation
    if (formData.twitter && !isValidTwitterUrl(formData.twitter)) {
      errors.twitter = 'Please enter a valid X (Twitter) URL or username';
    }
    
    // Initial buy amount validation
    const initialBuyNumber = parseFloat(formData.initialBuy);
    if (isNaN(initialBuyNumber) || initialBuyNumber < 0) {
      errors.initialBuy = 'Initial buy amount must be a valid number';
    } else if (initialBuyNumber > 100) {
      errors.initialBuy = 'Initial buy amount must not exceed 100 FAIR';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Check if URL is valid
   */
  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  /**
   * Check if Twitter URL or username is valid
   */
  const isValidTwitterUrl = (string) => {
    if (!string) return true; // Optional field
    
    // Handle both URL and username formats
    const twitterUrlPattern = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/;
    const usernamePattern = /^@?[a-zA-Z0-9_]+$/;
    
    return twitterUrlPattern.test(string) || usernamePattern.test(string);
  };

  /**
   * Format Twitter input to proper URL
   */
  const formatTwitterUrl = (input) => {
    if (!input) return '';
    
    // If it's already a URL, return as is
    if (input.startsWith('http')) {
      return input;
    }
    
    // If it's a username (with or without @), convert to URL
    const username = input.startsWith('@') ? input.slice(1) : input;
    return `https://x.com/${username}`;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!isConnected) {
      alert('Please connect your wallet to create a token');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    // Format the Twitter URL before submission
    const submissionData = {
      ...formData,
      twitter: formatTwitterUrl(formData.twitter)
    };
    
    // Call the parent component's create token function
    const success = await onCreateToken(submissionData);
    
    if (success) {
      // Reset form on successful creation
      setFormData({
        name: '',
        symbol: '',
        description: '',
        imageUrl: '',
        website: '',
        twitter: '',
        initialBuy: '0.1'
      });
    }
  };

  /**
   * Calculate total cost
   */
  const calculateTotalCost = () => {
    const initialBuy = parseFloat(formData.initialBuy) || 0;
    const creationFeeNumber = parseFloat(creationFee) || 0;
    return (initialBuy + creationFeeNumber).toFixed(4);
  };

  /**
   * Get form completion percentage for progress indication
   */
  const getFormCompletionPercentage = () => {
    const requiredFields = ['name', 'symbol', 'description', 'initialBuy'];
    const completedFields = requiredFields.filter(field => {
      const value = formData[field];
      return value && value.toString().trim().length > 0;
    });
    return Math.round((completedFields.length / requiredFields.length) * 100);
  };

  /**
   * Check if form is ready for submission
   */
  const isFormReady = () => {
    return formData.name.trim() && 
           formData.symbol.trim() && 
           formData.description.trim() &&
           formData.initialBuy && 
           parseFloat(formData.initialBuy) >= 0 &&
           Object.keys(validationErrors).length === 0;
  };

  return (
    <div className="create-token-form">
      <div className="form-header">
        <h2>CREATE YOUR OWN TOKEN</h2>
        <p>Create a new token with bonding curve mechanics and optional encryption</p>
        
        {/* Form Progress Indicator */}
        <div className="form-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${getFormCompletionPercentage()}%` }}
            />
          </div>
          <span className="progress-text">
            {getFormCompletionPercentage()}% Complete
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="token-form">
        <div className="form-grid">
          {/* Token Name */}
          <div className="form-group">
            <label htmlFor="token-name" className="form-label">
              Token Name *
            </label>
            <input
              id="token-name"
              type="text"
              className={`form-input ${validationErrors.name ? 'error' : ''}`}
              placeholder="e.g., My Awesome Token"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              maxLength={50}
            />
            {validationErrors.name && (
              <span className="error-message">{validationErrors.name}</span>
            )}
            <div className="input-hint">
              Choose a memorable and unique name for your token
            </div>
          </div>

          {/* Token Symbol */}
          <div className="form-group">
            <label htmlFor="token-symbol" className="form-label">
              Token Symbol *
            </label>
            <input
              id="token-symbol"
              type="text"
              className={`form-input ${validationErrors.symbol ? 'error' : ''}`}
              placeholder="e.g., MAT"
              value={formData.symbol}
              onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
              maxLength={10}
            />
            {validationErrors.symbol && (
              <span className="error-message">{validationErrors.symbol}</span>
            )}
            <div className="input-hint">
              Short identifier (2-10 characters, uppercase only)
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="token-description" className="form-label">
            Description *
          </label>
          <textarea
            id="token-description"
            className={`form-textarea ${validationErrors.description ? 'error' : ''}`}
            placeholder="Describe your token's purpose and utility..."
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className="character-count">
            {formData.description.length}/500 characters
          </div>
          {validationErrors.description && (
            <span className="error-message">{validationErrors.description}</span>
          )}
          <div className="input-hint">
            Explain what your token represents and its use case
          </div>
        </div>

        {/* Image URL */}
        <div className="form-group">
          <label htmlFor="token-image" className="form-label">
            Image URL (Optional)
          </label>
          <input
            id="token-image"
            type="url"
            className={`form-input ${validationErrors.imageUrl ? 'error' : ''}`}
            placeholder="https://example.com/token-image.png"
            value={formData.imageUrl}
            onChange={(e) => handleInputChange('imageUrl', e.target.value)}
          />
          {validationErrors.imageUrl && (
            <span className="error-message">{validationErrors.imageUrl}</span>
          )}
          <div className="input-hint">
            Add a logo or image to make your token more recognizable
          </div>
        </div>

        {/* Social Links Section */}
        <div className="form-section">
          <h3 className="section-title">
            <ExternalLink className="section-icon" />
            Social Links (Optional)
          </h3>
          <p className="section-description">
            Add your project's social presence to build trust and community
          </p>
          
          <div className="form-grid">
            {/* Website */}
            <div className="form-group">
              <label htmlFor="token-website" className="form-label">
                <ExternalLink className="form-label-icon" />
                Website
              </label>
              <input
                id="token-website"
                type="url"
                className={`form-input ${validationErrors.website ? 'error' : ''}`}
                placeholder="https://yourproject.com"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
              />
              {validationErrors.website && (
                <span className="error-message">{validationErrors.website}</span>
              )}
              <div className="input-hint">
                Your project's official website
              </div>
            </div>

            {/* X (Twitter) */}
            <div className="form-group">
              <label htmlFor="token-twitter" className="form-label">
                <Twitter className="form-label-icon" />
                X (Twitter)
              </label>
              <input
                id="token-twitter"
                type="text"
                className={`form-input ${validationErrors.twitter ? 'error' : ''}`}
                placeholder="@username"
                value={formData.twitter}
                onChange={(e) => handleInputChange('twitter', e.target.value)}
              />
              {validationErrors.twitter && (
                <span className="error-message">{validationErrors.twitter}</span>
              )}
              <div className="input-hint">
                Your project's X (Twitter) profile
              </div>
            </div>
          </div>
        </div>

        {/* Initial Buy Amount */}
        <div className="form-group">
          <label htmlFor="initial-buy" className="form-label">
            Initial Buy Amount (FAIR) *
          </label>
          <input
            id="initial-buy"
            type="number"
            step="0.01"
            min="0"
            max="100"
            className={`form-input ${validationErrors.initialBuy ? 'error' : ''}`}
            placeholder="0.1"
            value={formData.initialBuy}
            onChange={(e) => handleInputChange('initialBuy', e.target.value)}
          />
          {validationErrors.initialBuy && (
            <span className="error-message">{validationErrors.initialBuy}</span>
          )}
          <div className="input-hint">
            Amount to automatically purchase after token creation
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="cost-breakdown">
          <h3>Cost Breakdown</h3>
          <div className="cost-item">
            <span>Creation Fee:</span>
            <span>{creationFee} FAIR</span>
          </div>
          <div className="cost-item">
            <span>Initial Buy:</span>
            <span>{formData.initialBuy || '0'} FAIR</span>
          </div>
          <div className="cost-item total">
            <span>Total Cost:</span>
            <span>{calculateTotalCost()} FAIR</span>
          </div>
        </div>

        {/* Encryption Notice */}
        {encryptionEnabled ? (
          <div className="encryption-notice success">
            <Lock className="notice-icon" />
            <div className="notice-content">
              <h4>Private Launch Enabled</h4>
              <p>Your token creation will be encrypted and hidden from bots. MEV protection is active!</p>
              <ul className="encryption-benefits">
                <li>Transaction data encrypted</li>
                <li>Protected from front-running</li>
                <li>Fair launch guaranteed</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="encryption-notice warning">
            <Eye className="notice-icon" />
            <div className="notice-content">
              <h4>Public Launch</h4>
              <p>Your token creation will be visible to all users and MEV bots</p>
              <ul className="encryption-risks">
                <li>Transaction visible in mempool</li>
                <li>Vulnerable to front-running</li>
                <li>Bots may copy your trade</li>
              </ul>
            </div>
          </div>
        )}

        {/* Large Amount Warning */}
        {parseFloat(formData.initialBuy) > 10 && (
          <div className="encryption-notice warning">
            <AlertTriangle className="notice-icon" />
            <div className="notice-content">
              <h4>Large Initial Buy Warning</h4>
              <p>
                You're about to purchase {formData.initialBuy} FAIR worth of tokens. 
                {!encryptionEnabled && ' Consider enabling encryption to prevent front-running of this large order.'}
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className={`submit-button ${encryptionEnabled ? 'encrypted' : 'public'} ${!isFormReady() ? 'disabled' : ''}`}
          disabled={!isConnected || !isFormReady()}
        >
          <span>
            {encryptionEnabled ? (
              <>
                <span className="button-icon" />
                launch your token
              </>
            ) : (
              <>
                <span className="button-icon" />
                launch your token
              </>
            )}
          </span>
        </button>

        {!isConnected && (
          <p className="connection-warning">
            Please connect your wallet to create a token
          </p>
        )}

        {isConnected && !isFormReady() && (
          <p className="form-warning">
            Please fill in all required fields to continue
          </p>
        )}
      </form>
    </div>
  );
}

export default CreateTokenForm;