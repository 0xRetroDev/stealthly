// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BondingCurve.sol";
import "./LaunchToken.sol";

/**
 * @title TokenFactory
 * @dev Factory contract for deploying tokens with bonding curves on FAIR
 * 
 * This contract serves as the central hub for the token launch platform:
 * - Deploys new LaunchToken contracts with metadata and social links
 * - Creates corresponding BondingCurve contracts for each token
 * - Manages platform-wide settings and fees
 * - Tracks all deployed tokens for frontend enumeration
 * - Provides admin functions for platform maintenance
 * 
 * Architecture:
 * 1. User calls createToken() or createTokenWithSocials() with metadata and optional initial buy
 * 2. Factory deploys LaunchToken contract
 * 3. Factory deploys BondingCurve contract for that token
 * 4. Factory links the two contracts (sets minter)
 * 5. Factory processes any initial token purchase
 * 6. Factory emits event for frontend indexing
 * 
 * @author FAIR Token Launch Platform
 * @notice Factory contract for creating tokens with automated bonding curves
 */
contract TokenFactory {
    
    // ============ STATE VARIABLES ============
    
    /// @notice Owner of the factory contract (admin)
    address public owner;
    
    /// @notice Treasury address for fee collection
    address public treasury;
    
    /// @notice Platform fee percentage in basis points (e.g., 100 = 1%)
    uint256 public platformFeePercent = 100; // 1% default
    
    /// @notice Fee required to create a new token (in FAIR)
    uint256 public tokenCreationFee = 0.1 ether; // 0.1 FAIR default
    
    // ============ STORAGE MAPPINGS ============
    
    /// @notice Array of all deployed token addresses for enumeration
    address[] public allTokens;
    
    /// @notice Mapping from token address to its bonding curve address
    mapping(address => address) public tokenToBondingCurve;
    
    /// @notice Mapping to verify if a token was deployed by this factory
    mapping(address => bool) public isValidToken;
    
    // ============ EVENTS ============
    
    /**
     * @notice Emitted when a new token is created
     * @param token Address of the newly created token
     * @param bondingCurve Address of the bonding curve for this token
     * @param creator Address of the user who created the token
     * @param name Token name
     * @param symbol Token symbol
     * @param description Token description
     * @param imageUrl Token image URL
     * @param website Project website URL (empty string if not provided)
     * @param twitter Project Twitter/X URL (empty string if not provided)
     */
    event TokenCreated(
        address indexed token,
        address indexed bondingCurve,
        address indexed creator,
        string name,
        string symbol,
        string description,
        string imageUrl,
        string website,
        string twitter
    );
    
    /// @notice Emitted when platform fee is updated
    event PlatformFeeUpdated(uint256 newFee);
    
    /// @notice Emitted when token creation fee is updated
    event CreationFeeUpdated(uint256 newFee);
    
    /// @notice Emitted when treasury address is updated
    event TreasuryUpdated(address newTreasury);
    
    // ============ MODIFIERS ============
    
    /**
     * @dev Restricts function access to contract owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @dev Initializes the factory with treasury address
     * @param _treasury Address to receive platform fees
     * 
     * @notice Sets deployer as initial owner
     * @notice Treasury address cannot be zero
     */
    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        owner = msg.sender;
        treasury = _treasury;
    }
    
    // ============ TOKEN CREATION ============
    
    /**
     * @dev Creates a new token with bonding curve (backwards compatible version)
     * @param name Token name (e.g., "My Awesome Token")
     * @param symbol Token symbol (e.g., "MAT")
     * @param description Human-readable description of the token
     * @param imageUrl URL to token's image/logo
     * @param initialBuyAmount Amount of FAIR to spend on initial token purchase
     * @return token Address of the newly created token
     * @return bondingCurve Address of the bonding curve contract
     * 
     * @notice This function creates tokens without social links for backwards compatibility
     * @notice Use createTokenWithSocials() to include website and Twitter links
     */
    function createToken(
        string memory name,
        string memory symbol,
        string memory description,
        string memory imageUrl,
        uint256 initialBuyAmount
    ) external payable returns (address token, address bondingCurve) {
        return createTokenWithSocials(
            name,
            symbol,
            description,
            imageUrl,
            "", // empty website
            "", // empty twitter
            initialBuyAmount
        );
    }
    
    /**
     * @dev Creates a new token with bonding curve including social links
     * @param name Token name (e.g., "My Awesome Token")
     * @param symbol Token symbol (e.g., "MAT")
     * @param description Human-readable description of the token
     * @param imageUrl URL to token's image/logo
     * @param website Project website URL (can be empty)
     * @param twitter Project Twitter/X URL (can be empty)
     * @param initialBuyAmount Amount of FAIR to spend on initial token purchase
     * @return token Address of the newly created token
     * @return bondingCurve Address of the bonding curve contract
     * 
     * Requirements:
     * - Must send at least tokenCreationFee + initialBuyAmount FAIR
     * - Name and symbol cannot be empty
     * - Initial buy is optional (can be 0)
     * - Social links are optional (can be empty strings)
     * 
     * Process:
     * 1. Validate input parameters and payment
     * 2. Deploy LaunchToken contract with metadata and social links
     * 3. Deploy BondingCurve contract for the token
     * 4. Link contracts (set bonding curve as token minter)
     * 5. Update factory mappings and arrays
     * 6. Process initial token purchase if requested
     * 7. Send creation fee to treasury
     * 8. Emit TokenCreated event
     */
    function createTokenWithSocials(
        string memory name,
        string memory symbol,
        string memory description,
        string memory imageUrl,
        string memory website,
        string memory twitter,
        uint256 initialBuyAmount
    ) public payable returns (address token, address bondingCurve) {
        // Validate input parameters
        require(msg.value >= tokenCreationFee + initialBuyAmount, "Insufficient funds");
        require(bytes(name).length > 0, "Name required");
        require(bytes(symbol).length > 0, "Symbol required");
        
        // Deploy token contract with metadata and social links
        LaunchToken newToken = new LaunchToken(
            name,
            symbol,
            description,
            imageUrl,
            msg.sender, // Set creator as the caller
            website,
            twitter
        );
        token = address(newToken);
        
        // Deploy bonding curve contract for this token
        BondingCurve newBondingCurve = new BondingCurve(
            token,
            treasury, // Fees go directly to treasury
            platformFeePercent
        );
        bondingCurve = address(newBondingCurve);
        
        // Link contracts: set bonding curve as token minter
        newToken.setMinter(bondingCurve);
        
        // Update factory state
        allTokens.push(token);
        tokenToBondingCurve[token] = bondingCurve;
        isValidToken[token] = true;
        
        // Emit event for frontend indexing
        emit TokenCreated(
            token,
            bondingCurve,
            msg.sender,
            name,
            symbol,
            description,
            imageUrl,
            website,
            twitter
        );
        
        // Process initial token purchase if requested
        if (initialBuyAmount > 0) {
            // Forward the initial buy amount to bonding curve
            // Use 0 slippage tolerance since creator accepts any amount
            (bool success, ) = bondingCurve.call{value: initialBuyAmount}(
                abi.encodeWithSignature("buyTokensFor(address,uint256)", msg.sender, 0)
            );
            require(success, "Initial buy failed");
        }
        
        // Send creation fee to treasury
        if (tokenCreationFee > 0) {
            payable(treasury).transfer(tokenCreationFee);
        }
        
        return (token, bondingCurve);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Returns all deployed token addresses
     * @return Array of all token addresses deployed by this factory
     * 
     * @notice Used by frontend to enumerate all tokens
     * @notice May be gas-intensive for large numbers of tokens
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
    
    /**
     * @dev Returns the total number of tokens created
     * @return Total count of tokens deployed
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }
    
    /**
     * @dev Gets the bonding curve address for a given token
     * @param token Address of the token
     * @return Address of the corresponding bonding curve
     */
    function getBondingCurve(address token) external view returns (address) {
        return tokenToBondingCurve[token];
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Updates the treasury address
     * @param _treasury New treasury address
     * 
     * @notice Only callable by owner
     * @notice Treasury cannot be zero address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    /**
     * @dev Updates the Trader Joe router for a specific token's bonding curve
     * @param token Address of the token
     * @param newRouter Address of the new router
     * 
     * @notice Only callable by owner
     * @notice Used to update router addresses if needed
     */
    function updateTokenRouter(address token, address newRouter) external onlyOwner {
        require(isValidToken[token], "Invalid token");
        address bondingCurve = tokenToBondingCurve[token];
        require(bondingCurve != address(0), "No bonding curve");
        
        // Call the bonding curve's router update function
        (bool success, ) = bondingCurve.call(
            abi.encodeWithSignature("setTraderJoeRouter(address)", newRouter)
        );
        require(success, "Router update failed");
    }
    
    /**
     * @dev Updates the platform fee percentage
     * @param _feePercent New fee percentage in basis points
     * 
     * @notice Only callable by owner
     * @notice Maximum fee is 10% (1000 basis points) for safety
     * @notice Only affects newly created tokens
     */
    function setPlatformFee(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 1000, "Fee too high"); // Max 10%
        platformFeePercent = _feePercent;
        emit PlatformFeeUpdated(_feePercent);
    }
    
    /**
     * @dev Updates the token creation fee
     * @param _fee New creation fee in FAIR (wei)
     * 
     * @notice Only callable by owner
     * @notice Can be set to 0 to allow free token creation
     */
    function setCreationFee(uint256 _fee) external onlyOwner {
        tokenCreationFee = _fee;
        emit CreationFeeUpdated(_fee);
    }
    
    /**
     * @dev Transfers ownership of the factory to a new address
     * @param newOwner Address of the new owner
     * 
     * @notice Only callable by current owner
     * @notice New owner cannot be zero address
     * @notice This is irreversible, use with caution
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @dev Emergency function to force graduation of a token
     * @param token Address of the token to graduate
     * 
     * @notice Only callable by owner
     * @notice Used in emergency situations where automatic graduation fails
     * @notice Token must have reached graduation threshold
     */
    function emergencyGraduateToken(address token) external onlyOwner {
        require(isValidToken[token], "Invalid token");
        address bondingCurve = tokenToBondingCurve[token];
        require(bondingCurve != address(0), "No bonding curve");
        
        // Call the bonding curve's force graduation function
        (bool success, ) = bondingCurve.call(
            abi.encodeWithSignature("forceGraduation()")
        );
        require(success, "Graduation failed");
    }
    
    /**
     * @dev Emergency function to withdraw FAIR from a bonding curve
     * @param token Address of the token whose bonding curve to withdraw from
     * 
     * @notice Only callable by owner
     * @notice Used in emergency situations where funds are stuck
     */
    function emergencyWithdrawFromCurve(address token) external onlyOwner {
        require(isValidToken[token], "Invalid token");
        address bondingCurve = tokenToBondingCurve[token];
        require(bondingCurve != address(0), "No bonding curve");
        
        // Call the bonding curve's emergency withdraw function
        (bool success, ) = bondingCurve.call(
            abi.encodeWithSignature("emergencyWithdraw()")
        );
        require(success, "Emergency withdraw failed");
    }
    
    // ============ RECEIVE FUNCTION ============
    
    /**
     * @dev Allows contract to receive FAIR
     * @notice FAIR sent directly to this contract goes to treasury
     */
    receive() external payable {
        // Forward any FAIR sent directly to the treasury
        if (msg.value > 0) {
            payable(treasury).transfer(msg.value);
        }
    }
}