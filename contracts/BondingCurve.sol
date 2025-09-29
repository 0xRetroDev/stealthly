// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LaunchToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ITraderJoeRouter
 * @dev Interface for Trader Joe router functions needed for graduation
 */
interface ITraderJoeRouter {
    function addLiquidityFAIR(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountFAIRMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountFAIR, uint liquidity);
}

/**
 * @title BondingCurve
 * @dev Pump.fun-style bonding curve implementation for FAIR
 * 
 * Features:
 * - Exponential bonding curve for price discovery
 * - Anti-dump mechanism with time-decaying fees
 * - Automatic graduation to Trader Joe DEX
 * - Real-time price calculations and previews
 * - Reentrancy protection on all state-changing functions
 * 
 * Economics:
 * - 700M tokens available on curve (70% of supply)
 * - Graduation at 8,055 FAIR raised (~$145K at $18 FAIR)
 * - Anti-dump fees: 20% → 1% over 15 minutes
 * - Platform fee: Configurable basis points on buys
 * 
 * @author FAIR Token Launch Platform
 * @notice This contract implements a bonding curve for token price discovery and trading
 */
contract BondingCurve is ReentrancyGuard {
    
    // ============ IMMUTABLE STATE ============
    
    /// @notice The ERC20 token being traded on this curve
    LaunchToken public immutable token;
    
    /// @notice Factory contract that deployed this bonding curve
    address public immutable factory;
    
    /// @notice Treasury address for fee collection
    address public immutable treasury;
    
    /// @notice Platform fee percentage in basis points (e.g., 100 = 1%)
    uint256 public immutable platformFeePercent;
    
    /// @notice Timestamp when this bonding curve was deployed
    uint256 public immutable launchTime;
    
    // ============ CURVE CONSTANTS ============
    
    /// @notice FAIR amount needed to trigger graduation (~$145K at $18 FAIR)
    uint256 public constant GRADUATION_THRESHOLD = 8050 ether;
    
    /// @notice Tokens available for purchase on the curve (700M)
    uint256 public constant GRADUATION_SUPPLY = 700_000_000 * 1e18;
    
    /// @notice Total token supply (1B tokens)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18;
    
    /// @notice Tokens allocated for liquidity (300M)
    uint256 public constant LIQUIDITY_TOKENS = 300_000_000 * 1e18;
    
    /// @notice FAIR allocated for liquidity (~$105K worth)
    uint256 public constant LIQUIDITY_FAIR = 5833 ether;
    
    // ============ BONDING CURVE MATH CONSTANTS ============
    
    /**
     * @dev Virtual reserves for bonding curve calculations
     * 
     * These values create an exponential curve that:
     * - Starts with reasonable token amounts for small FAIR
     * - Ends with 700M tokens total for 8,050 FAIR
     * - Uses constant product formula: (virtualFAIR + realFAIR) * (virtualTokens - realTokens) = k
     */
    uint256 private constant VIRTUAL_FAIR_RESERVES = 570 ether;
    uint256 private constant VIRTUAL_TOKEN_RESERVES = 750_000_000 * 1e18;
    
    // ============ ANTI-DUMP CONSTANTS ============
    
    /// @notice Duration of anti-dump fee decay period (15 minutes)
    uint256 public constant ANTI_DUMP_DURATION = 15 minutes;
    
    /// @notice Initial sell fee when token launches (20%)
    uint256 public constant INITIAL_SELL_FEE = 2000; // basis points
    
    /// @notice Final sell fee after decay period (1%)
    uint256 public constant FINAL_SELL_FEE = 100; // basis points
    
    // ============ MUTABLE STATE ============
    
    /// @notice Total tokens sold through the bonding curve
    uint256 public tokensSold;
    
    /// @notice Total FAIR raised through token sales
    uint256 public FAIRRaised;
    
    /// @notice Whether this token has graduated to DEX
    bool public graduated;
    
    /// @notice Trader Joe router address for liquidity provision
    address public traderJoeRouter;
    
    // ============ EVENTS ============
    
    /// @notice Emitted when tokens are purchased
    event TokensPurchased(
        address indexed buyer,
        uint256 FAIRIn,
        uint256 tokensOut,
        uint256 newPrice
    );
    
    /// @notice Emitted when tokens are sold
    event TokensSold(
        address indexed seller,
        uint256 tokensIn,
        uint256 FAIROut,
        uint256 fee
    );
    
    /// @notice Emitted when token graduates to DEX
    event Graduated(
        uint256 liquidityTokens,
        uint256 liquidityFAIR,
        uint256 teamFAIR,
        uint256 lpTokensBurned
    );
    
    /// @notice Emitted on price updates for frontend tracking
    event PriceUpdate(
        uint256 tokensSold,
        uint256 currentPrice,
        uint256 marketCap
    );
    
    // ============ MODIFIERS ============
    
    /**
     * @dev Ensures function can only be called before graduation
     */
    modifier notGraduated() {
        require(!graduated, "Token graduated");
        _;
    }
    
    /**
     * @dev Restricts function access to the factory contract
     */
    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @dev Initializes the bonding curve with token and fee parameters
     * @param _token Address of the LaunchToken contract
     * @param _treasury Address to receive platform fees
     * @param _platformFeePercent Fee percentage in basis points
     * 
     * @notice Automatically detects network and sets appropriate router
     */
    constructor(
        address _token,
        address _treasury,
        uint256 _platformFeePercent
    ) {
        token = LaunchToken(_token);
        factory = msg.sender;
        treasury = _treasury;
        platformFeePercent = _platformFeePercent;
        launchTime = block.timestamp;
        
        // Set router based on network for automatic graduation
        uint256 chainId;
        assembly { chainId := chainid() }
        
        if (chainId == 43113) {
            // Avalanche Fuji Testnet
            traderJoeRouter = 0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106;
        } else if (chainId == 43114) {
            // Avalanche Mainnet
            traderJoeRouter = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
        } else {
            // Default to mainnet
            traderJoeRouter = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
        }
    }
    
    // ============ EXTERNAL TRADING FUNCTIONS ============
    
    /**
     * @dev Buy tokens with FAIR using bonding curve pricing
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     * 
     * @notice Caller receives tokens directly
     * @notice Subject to platform fees and graduation check
     */
    function buyTokens(uint256 minTokensOut) external payable notGraduated nonReentrant {
        _buyTokensFor(msg.sender, minTokensOut);
    }
    
    /**
     * @dev Buy tokens for another address (used by factory for initial purchases)
     * @param recipient Address to receive the tokens
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     */
    function buyTokensFor(address recipient, uint256 minTokensOut) external payable notGraduated nonReentrant {
        require(msg.sender == factory, "Only factory");
        _buyTokensFor(recipient, minTokensOut);
    }
    
    /**
     * @dev Sell tokens back to the bonding curve for FAIR
     * @param tokenAmount Amount of tokens to sell
     * @param minFAIROut Minimum FAIR to receive (slippage protection)
     * 
     * @notice Subject to anti-dump fees
     * @notice Requires token approval for this contract
     */
    function sellTokens(uint256 tokenAmount, uint256 minFAIROut) external notGraduated nonReentrant {
        require(tokenAmount > 0, "Invalid amount");
        require(tokensSold >= tokenAmount, "Insufficient supply sold");
        require(token.balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        // Calculate FAIR output using reverse bonding curve
        uint256 FAIROut = _calculateFAIROut(tokenAmount);
        require(FAIROut > 0, "No FAIR calculated");
        require(FAIROut <= FAIRRaised, "Insufficient reserves");
        
        // Apply anti-dump fee based on time since launch
        uint256 sellFee = getCurrentSellFee();
        uint256 feeAmount = (FAIROut * sellFee) / 10000;
        uint256 netFAIROut = FAIROut - feeAmount;
        require(netFAIROut >= minFAIROut, "Slippage exceeded");
        
        // Update state BEFORE external calls (CEI pattern)
        tokensSold -= tokenAmount;
        FAIRRaised -= FAIROut;
        
        // Burn tokens from seller
        token.burnFrom(msg.sender, tokenAmount);
        
        // Transfer FAIR to seller
        payable(msg.sender).transfer(netFAIROut);
        
        // Send fee to treasury
        if (feeAmount > 0) {
            payable(treasury).transfer(feeAmount);
        }
        
        emit TokensSold(msg.sender, tokenAmount, netFAIROut, feeAmount);
        emit PriceUpdate(tokensSold, getCurrentPrice(), getMarketCap());
    }
    
    // ============ INTERNAL TRADING LOGIC ============
    
    /**
     * @dev Internal function to handle token purchases
     * @param recipient Address to receive tokens
     * @param minTokensOut Minimum tokens for slippage protection
     */
    function _buyTokensFor(address recipient, uint256 minTokensOut) internal {
        require(msg.value > 0, "Must send FAIR");
        require(tokensSold < GRADUATION_SUPPLY, "Curve complete");
        
        // Calculate and deduct platform fee
        uint256 platformFee = (msg.value * platformFeePercent) / 10000;
        uint256 buyAmount = msg.value - platformFee;
        require(buyAmount > 0, "Insufficient after fees");
        
        // Calculate tokens using bonding curve formula
        uint256 tokensOut = _calculateTokensOut(buyAmount);
        require(tokensOut > 0, "No tokens calculated");
        require(tokensOut >= minTokensOut, "Slippage exceeded");
        require(tokensSold + tokensOut <= GRADUATION_SUPPLY, "Exceeds graduation supply");
        
        // Update state BEFORE external calls (CEI pattern)
        tokensSold += tokensOut;
        FAIRRaised += buyAmount;
        
        // Mint tokens to recipient
        token.mint(recipient, tokensOut);
        
        // Send platform fee to treasury
        if (platformFee > 0) {
            payable(treasury).transfer(platformFee);
        }
        
        // Calculate new price for events
        uint256 newPrice = getCurrentPrice();
        
        emit TokensPurchased(recipient, buyAmount, tokensOut, newPrice);
        emit PriceUpdate(tokensSold, newPrice, getMarketCap());
        
        // Check for graduation threshold
        if (FAIRRaised >= GRADUATION_THRESHOLD) {
            _executeGraduation();
        }
    }
    
    // ============ BONDING CURVE MATHEMATICS ============
    
    /**
     * @dev Calculates tokens received for a given FAIR input
     * @param FAIRAmount Amount of FAIR being spent
     * @return tokensOut Amount of tokens to be received
     * 
     * Uses constant product formula:
     * (virtualFAIR + realFAIR) * (virtualTokens - realTokens) = k
     * 
     * This creates exponential price growth:
     * - Early buyers get millions of tokens for small FAIR
     * - Later buyers get fewer tokens for same FAIR
     * - Price approaches infinity as supply approaches virtual limit
     */
    function _calculateTokensOut(uint256 FAIRAmount) internal view returns (uint256) {
        // Current state of virtual reserves
        uint256 currentFAIRReserve = VIRTUAL_FAIR_RESERVES + FAIRRaised;
        uint256 currentTokenReserve = VIRTUAL_TOKEN_RESERVES - tokensSold;
        
        // State after adding FAIR
        uint256 newFAIRReserve = currentFAIRReserve + FAIRAmount;
        
        // Constant product: k = currentFAIRReserve * currentTokenReserve
        uint256 k = currentFAIRReserve * currentTokenReserve;
        
        // Solve for new token reserve: newTokenReserve = k / newFAIRReserve
        uint256 newTokenReserve = k / newFAIRReserve;
        
        // Tokens out = reduction in token reserve
        uint256 tokensOut = currentTokenReserve - newTokenReserve;
        
        // Ensure we don't exceed graduation supply
        uint256 maxTokens = GRADUATION_SUPPLY - tokensSold;
        if (tokensOut > maxTokens) {
            tokensOut = maxTokens;
        }
        
        return tokensOut;
    }
    
    /**
     * @dev Calculates FAIR received for selling tokens (reverse of buy calculation)
     * @param tokenAmount Amount of tokens being sold
     * @return FAIROut Amount of FAIR to be received
     */
    function _calculateFAIROut(uint256 tokenAmount) internal view returns (uint256) {
        // Current state of virtual reserves
        uint256 currentFAIRReserve = VIRTUAL_FAIR_RESERVES + FAIRRaised;
        uint256 currentTokenReserve = VIRTUAL_TOKEN_RESERVES - tokensSold;
        
        // State after adding tokens back
        uint256 newTokenReserve = currentTokenReserve + tokenAmount;
        
        // Constant product: k = currentFAIRReserve * currentTokenReserve
        uint256 k = currentFAIRReserve * currentTokenReserve;
        
        // Solve for new FAIR reserve: newFAIRReserve = k / newTokenReserve
        uint256 newFAIRReserve = k / newTokenReserve;
        
        // FAIR out = reduction in FAIR reserve
        uint256 FAIROut = currentFAIRReserve - newFAIRReserve;
        
        return FAIROut;
    }
    
    // ============ ANTI-DUMP MECHANISM ============
    
    /**
     * @dev Calculates current sell fee based on time since launch
     * @return Current sell fee in basis points
     */
    function getCurrentSellFee() public view returns (uint256) {
        if (block.timestamp >= launchTime + ANTI_DUMP_DURATION) {
            return FINAL_SELL_FEE;
        }
        
        uint256 elapsed = block.timestamp - launchTime;
        uint256 feeReduction = ((INITIAL_SELL_FEE - FINAL_SELL_FEE) * elapsed) / ANTI_DUMP_DURATION;
        
        return INITIAL_SELL_FEE - feeReduction;
    }
    
    // ============ PRICE CALCULATION FUNCTIONS ============
    
    /**
     * @dev Gets current spot price per token in FAIR
     * @return Current price in FAIR per token (18 decimals)
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 currentFAIRReserve = VIRTUAL_FAIR_RESERVES + FAIRRaised;
        uint256 currentTokenReserve = VIRTUAL_TOKEN_RESERVES - tokensSold;
        
        return (currentFAIRReserve * 1e18) / currentTokenReserve;
    }
    
    /**
     * @dev Calculates market cap of sold tokens
     * @return Market cap in FAIR (18 decimals)
     */
    function getMarketCap() public view returns (uint256) {
        if (tokensSold == 0) return 0;
        return (getCurrentPrice() * tokensSold) / 1e18;
    }
    
    // ============ PREVIEW FUNCTIONS ============
    
    /**
     * @dev Preview buy transaction without executing
     */
    function previewBuy(uint256 FAIRAmount) external view returns (
        uint256 tokensOut,
        uint256 newPrice,
        uint256 priceImpact,
        uint256 platformFee
    ) {
        if (FAIRAmount == 0 || graduated) return (0, 0, 0, 0);
        
        platformFee = (FAIRAmount * platformFeePercent) / 10000;
        uint256 buyAmount = FAIRAmount - platformFee;
        
        if (buyAmount == 0) return (0, 0, 0, platformFee);
        
        uint256 currentPrice = getCurrentPrice();
        tokensOut = _calculateTokensOut(buyAmount);
        
        if (tokensOut == 0) return (0, currentPrice, 0, platformFee);
        
        uint256 newFAIRReserve = VIRTUAL_FAIR_RESERVES + FAIRRaised + buyAmount;
        uint256 newTokenReserve = VIRTUAL_TOKEN_RESERVES - tokensSold - tokensOut;
        newPrice = (newFAIRReserve * 1e18) / newTokenReserve;
        
        priceImpact = newPrice > currentPrice ? 
            ((newPrice - currentPrice) * 10000) / currentPrice : 0;
        
        if (tokensSold + tokensOut > GRADUATION_SUPPLY) {
            tokensOut = GRADUATION_SUPPLY - tokensSold;
        }
    }
    
    /**
     * @dev Preview sell transaction without executing
     */
    function previewSell(uint256 tokenAmount) external view returns (
        uint256 FAIROut,
        uint256 netFAIROut,
        uint256 sellFee,
        uint256 feeAmount
    ) {
        if (tokenAmount == 0 || graduated || tokenAmount > tokensSold) {
            return (0, 0, 0, 0);
        }
        
        FAIROut = _calculateFAIROut(tokenAmount);
        sellFee = getCurrentSellFee();
        feeAmount = (FAIROut * sellFee) / 10000;
        netFAIROut = FAIROut - feeAmount;
    }
    
    // ============ EXTERNAL VIEW FUNCTIONS ============
    
    function calculateTokensForFAIR(uint256 FAIRAmount) external view returns (uint256) {
        if (FAIRAmount == 0 || graduated) return 0;
        return _calculateTokensOut(FAIRAmount);
    }
    
    function calculateFAIRForTokens(uint256 tokenAmount) external view returns (uint256) {
        if (tokenAmount == 0 || graduated) return 0;
        return _calculateFAIROut(tokenAmount);
    }
    
    /**
     * @dev Get comprehensive token information for frontend
     * @return _tokensSold Total tokens sold
     * @return _FAIRRaised Total FAIR raised
     * @return _currentSellFee Current sell fee in basis points
     * @return _graduated Whether token has graduated
     * @return _progress Progress to graduation in basis points (10000 = 100%)
     */
    function getTokenInfo() external view returns (
        uint256 _tokensSold,
        uint256 _FAIRRaised,
        uint256 _currentSellFee,
        bool _graduated,
        uint256 _progress
    ) {
        return (
            tokensSold,
            FAIRRaised,
            getCurrentSellFee(),
            graduated,
            (FAIRRaised * 10000) / GRADUATION_THRESHOLD
        );
    }
    
    // ============ GRADUATION LOGIC ============
    
    /**
     * @dev Executes graduation to Trader Joe DEX
     * 
     * Process:
     * 1. Enable trading on token contract
     * 2. Mint tokens for liquidity provision
     * 3. Add liquidity to Trader Joe (token/FAIR pair)
     * 4. Burn LP tokens to ensure permanent liquidity
     * 5. Send remaining FAIR to treasury
     * 
     * @notice Automatically triggered when GRADUATION_THRESHOLD is reached
     */
    function _executeGraduation() internal {
        require(!graduated, "Already graduated");
        require(FAIRRaised >= GRADUATION_THRESHOLD, "Threshold not met");
        
        graduated = true;
        token.enableTrading();
        
        // Calculate allocation splits
        uint256 liquidityTokens = LIQUIDITY_TOKENS; // 300M tokens
        uint256 liquidityFAIR = LIQUIDITY_FAIR;     // 3,500 FAIR
        uint256 teamFAIR = FAIRRaised - liquidityFAIR; // Remaining FAIR to team
        
        // Mint tokens for liquidity provision
        token.mint(address(this), liquidityTokens);
        token.approve(traderJoeRouter, liquidityTokens);
        
        // Add liquidity and burn LP tokens for permanent liquidity
        try ITraderJoeRouter(traderJoeRouter).addLiquidityFAIR{value: liquidityFAIR}(
            address(token),
            liquidityTokens,
            (liquidityTokens * 95) / 100, // 5% slippage tolerance
            (liquidityFAIR * 95) / 100,   // 5% slippage tolerance
            address(0x000000000000000000000000000000000000dEaD), // Burn LP tokens
            block.timestamp + 300 // 5 minute deadline
        ) returns (uint256, uint256, uint256 lpTokens) {
            
            // Send team allocation to treasury
            if (teamFAIR > 0) {
                payable(treasury).transfer(teamFAIR);
            }
            
            // Reset curve state
            FAIRRaised = 0;
            
            emit Graduated(liquidityTokens, liquidityFAIR, teamFAIR, lpTokens);
            
        } catch {
            // If graduation fails, revert the graduated state
            graduated = false;
        }
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function setTraderJoeRouter(address _router) external onlyFactory {
        require(_router != address(0), "Invalid router");
        traderJoeRouter = _router;
    }
    
    function emergencyWithdraw() external onlyFactory {
        payable(treasury).transfer(address(this).balance);
    }
    
    function forceGraduation() external onlyFactory {
        require(!graduated, "Already graduated");
        require(FAIRRaised >= GRADUATION_THRESHOLD, "Threshold not met");
        _executeGraduation();
    }
    
    // ============ RECEIVE FUNCTION ============
    
    receive() external payable {}
}