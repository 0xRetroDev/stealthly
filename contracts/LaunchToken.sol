// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title LaunchToken
 * @dev ERC20 token contract for tokens created through the launch platform
 * 
 * Features:
 * - Standard ERC20 functionality with burn capability
 * - Controlled minting (only bonding curve can mint)
 * - Trading restrictions until graduation
 * - Metadata storage for frontend display
 * - Creator attribution and launch timestamp
 * - Social links storage (website, Twitter)
 * 
 * @author FAIR Token Launch Platform
 * @notice This contract represents a token launched through the platform's bonding curve mechanism
 */
contract LaunchToken is ERC20, ERC20Burnable {
    
    // ============ STATE VARIABLES ============
    
    /// @notice Address authorized to mint tokens (bonding curve contract)
    address public minter;
    
    /// @notice Whether trading is enabled for this token
    /// @dev Set to true when token graduates from bonding curve
    bool public tradingEnabled;
    
    // Token metadata for frontend display
    /// @notice Human-readable description of the token
    string public description;
    
    /// @notice URL to token's image/logo
    string public imageUrl;
    
    /// @notice Address of the token creator
    address public creator;
    
    /// @notice Timestamp when token was launched
    uint256 public launchTime;
    
    // Social links
    /// @notice Project website URL
    string public website;
    
    /// @notice Project Twitter/X URL
    string public twitter;
    
    // ============ MODIFIERS ============
    
    /**
     * @dev Restricts function access to the designated minter (bonding curve)
     */
    modifier onlyMinter() {
        require(msg.sender == minter, "Not minter");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @dev Initializes the token with metadata and creator information
     * @param name Token name (e.g., "My Awesome Token")
     * @param symbol Token symbol (e.g., "MAT")
     * @param _description Human-readable description of the token
     * @param _imageUrl URL to token's image/logo
     * @param _creator Address of the token creator
     * @param _website Project website URL (optional)
     * @param _twitter Project Twitter/X URL (optional)
     * 
     * @notice Minter must be set separately by the factory after deployment
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory _description,
        string memory _imageUrl,
        address _creator,
        string memory _website,
        string memory _twitter
    ) ERC20(name, symbol) {
        description = _description;
        imageUrl = _imageUrl;
        creator = _creator;
        launchTime = block.timestamp;
        website = _website;
        twitter = _twitter;
        // Note: Minter will be set by factory after deployment for security
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Sets the minter address (bonding curve contract)
     * @param _minter Address of the bonding curve contract
     * 
     * @notice Can only be called once for security
     * @notice Called by the factory immediately after deployment
     */
    function setMinter(address _minter) external {
        require(minter == address(0), "Minter already set");
        minter = _minter;
    }
    
    /**
     * @dev Enables trading for this token
     * @notice Called by bonding curve when token graduates
     * @notice Once enabled, cannot be disabled
     */
    function enableTrading() external onlyMinter {
        tradingEnabled = true;
    }
    
    // ============ MINTING FUNCTIONS ============
    
    /**
     * @dev Mints tokens to specified address
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint (in wei)
     * 
     * @notice Only callable by the bonding curve contract
     * @notice Used when users buy tokens through the bonding curve
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Returns all metadata in a single call for frontend efficiency
     * @return _description Token description
     * @return _imageUrl Token image URL
     * @return _creator Creator address
     * @return _launchTime Launch timestamp
     */
    function getMetadata() external view returns (
        string memory _description,
        string memory _imageUrl,
        address _creator,
        uint256 _launchTime
    ) {
        return (description, imageUrl, creator, launchTime);
    }
    
    /**
     * @dev Returns social links in a single call for frontend efficiency
     * @return _website Project website URL
     * @return _twitter Project Twitter/X URL
     */
    function getSocialLinks() external view returns (
        string memory _website,
        string memory _twitter
    ) {
        return (website, twitter);
    }
    
    /**
     * @dev Returns all metadata and social links in a single call
     * @return _description Token description
     * @return _imageUrl Token image URL
     * @return _creator Creator address
     * @return _launchTime Launch timestamp
     * @return _website Project website URL
     * @return _twitter Project Twitter/X URL
     */
    function getFullMetadata() external view returns (
        string memory _description,
        string memory _imageUrl,
        address _creator,
        uint256 _launchTime,
        string memory _website,
        string memory _twitter
    ) {
        return (description, imageUrl, creator, launchTime, website, twitter);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @dev Override of ERC20 _update to implement trading restrictions
     * @param from Source address (address(0) for minting)
     * @param to Destination address (address(0) for burning)
     * @param amount Amount being transferred
     * 
     * Transfer Rules:
     * - Minting (from = 0): Always allowed
     * - Burning (to = 0): Always allowed  
     * - Minter transfers: Always allowed (bonding curve operations)
     * - User transfers: Only allowed after trading is enabled
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Allow minting and burning always
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        
        // Allow minter (bonding curve) to transfer always
        // This enables buy/sell operations before graduation
        if (from == minter || to == minter) {
            super._update(from, to, amount);
            return;
        }
        
        // Require trading to be enabled for other transfers
        // This prevents secondary trading before graduation
        require(tradingEnabled, "Trading not enabled");
        super._update(from, to, amount);
    }
}