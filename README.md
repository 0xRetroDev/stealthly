# Token Launch Platform on FAIR

A Pump.fun-style token launch platform built on FAIR Chain with BITE encryption for secure token creation and trading.

## Features

- **Exponential Bonding Curve**: Fair price discovery from launch to graduation
- **Anti-Dump Protection**: Time-decaying fees (20% → 1% over 15 minutes)
- **Auto-Graduation**: Automatic DEX listing when threshold is reached
- **BITE Encryption**: Transaction security through FAIR's native encryption layer

## How It Works

1. **Create**: Deploy your token with metadata and optional initial buy
2. **Trade**: Buy/sell on the bonding curve with transparent pricing
3. **Graduate**: Automatic liquidity provision to DEX at ~8,057 AVAX raised

## Smart Contracts

- `TokenFactory.sol` - Token deployment and fee management
- `BondingCurve.sol` - Exponential curve trading with anti-dump fees
- `LaunchToken.sol` - ERC20 token with trading restrictions
- `TokenAdminLib.sol` - Batch operations and analytics
```

## Security

- **BITE Encryption**: All transactions secured through FAIR's encryption 

## ⚠️ Disclaimer

This is a demo project for educational purposes. Play responsibly and never gamble more than you can afford to lose.

---

**Built with ❤️ on FAIR Network**
