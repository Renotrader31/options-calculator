// API Route: /api/calculate
// Handles options pricing and strategy calculations

import { BlackScholesCalculator, OptionsStrategy } from '../../../lib/blackScholes.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      calculationType, 
      stockPrice, 
      riskFreeRate = 0.05, 
      impliedVolatility = 0.25,
      legs = [],
      priceRange = null
    } = req.body;

    if (!stockPrice || stockPrice <= 0) {
      return res.status(400).json({ error: 'Valid stock price is required' });
    }

    const bs = new BlackScholesCalculator();
    const strategy = new OptionsStrategy();

    switch (calculationType) {
      case 'single_option':
        return handleSingleOption(req, res, bs);

      case 'strategy':
        return handleStrategy(req, res, strategy, stockPrice, riskFreeRate, impliedVolatility);

      case 'greeks':
        return handleGreeks(req, res, bs);

      case 'implied_volatility':
        return handleImpliedVolatility(req, res, bs);

      default:
        return res.status(400).json({ error: 'Invalid calculation type' });
    }

  } catch (error) {
    console.error('Calculation error:', error);
    return res.status(500).json({ error: 'Calculation failed', details: error.message });
  }
}

function handleSingleOption(req, res, bs) {
  const { 
    strike, 
    expiration, 
    optionType, 
    stockPrice, 
    riskFreeRate = 0.05, 
    impliedVolatility = 0.25 
  } = req.body;

  if (!strike || !expiration || !optionType) {
    return res.status(400).json({ error: 'Strike, expiration, and option type are required' });
  }

  const T = bs.timeToExpiration(expiration);
  const greeks = bs.calculateAllGreeks(stockPrice, strike, T, riskFreeRate, impliedVolatility, optionType);

  return res.status(200).json({
    success: true,
    result: {
      price: greeks.price,
      greeks: {
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        vega: greeks.vega,
        rho: greeks.rho
      },
      timeToExpiration: T,
      intrinsicValue: optionType === 'call' ? 
        Math.max(0, stockPrice - strike) : 
        Math.max(0, strike - stockPrice),
      timeValue: greeks.price - (optionType === 'call' ? 
        Math.max(0, stockPrice - strike) : 
        Math.max(0, strike - stockPrice))
    }
  });
}

function handleStrategy(req, res, strategy, stockPrice, riskFreeRate, impliedVolatility) {
  const { legs, priceRange } = req.body;

  if (!legs || legs.length === 0) {
    return res.status(400).json({ error: 'At least one option leg is required' });
  }

  // Add all legs to strategy
  legs.forEach(leg => {
    strategy.addLeg(
      leg.type, 
      leg.strike, 
      leg.premium, 
      leg.quantity, 
      leg.optionType, 
      leg.expiration
    );
  });

  // Calculate strategy summary
  const summary = strategy.getStrategySummary(stockPrice, riskFreeRate, impliedVolatility);

  // Generate P&L curve data
  const plData = generatePLCurve(strategy, priceRange, stockPrice);

  return res.status(200).json({
    success: true,
    result: {
      summary,
      plData,
      legs: legs.length,
      netPremium: summary.totalPremium
    }
  });
}

function handleGreeks(req, res, bs) {
  const { 
    strike, 
    expiration, 
    optionType, 
    stockPrice, 
    riskFreeRate = 0.05, 
    impliedVolatility = 0.25 
  } = req.body;

  const T = bs.timeToExpiration(expiration);
  const greeks = bs.calculateAllGreeks(stockPrice, strike, T, riskFreeRate, impliedVolatility, optionType);

  // Calculate Greeks at different stock prices for sensitivity analysis
  const greeksSensitivity = [];
  const priceRange = stockPrice * 0.2; // ±20%

  for (let price = stockPrice - priceRange; price <= stockPrice + priceRange; price += priceRange / 10) {
    const g = bs.calculateAllGreeks(price, strike, T, riskFreeRate, impliedVolatility, optionType);
    greeksSensitivity.push({
      stockPrice: price,
      ...g
    });
  }

  return res.status(200).json({
    success: true,
    result: {
      current: greeks,
      sensitivity: greeksSensitivity
    }
  });
}

function handleImpliedVolatility(req, res, bs) {
  const { 
    marketPrice, 
    strike, 
    expiration, 
    optionType, 
    stockPrice, 
    riskFreeRate = 0.05 
  } = req.body;

  if (!marketPrice || marketPrice <= 0) {
    return res.status(400).json({ error: 'Valid market price is required' });
  }

  const T = bs.timeToExpiration(expiration);
  const impliedVol = bs.impliedVolatility(marketPrice, stockPrice, strike, T, riskFreeRate, optionType);

  return res.status(200).json({
    success: true,
    result: {
      impliedVolatility: impliedVol,
      annualizedPercentage: (impliedVol * 100).toFixed(2) + '%'
    }
  });
}

function generatePLCurve(strategy, priceRange, currentStockPrice) {
  const range = priceRange || currentStockPrice * 0.5; // Default ±50%
  const startPrice = Math.max(0.01, currentStockPrice - range);
  const endPrice = currentStockPrice + range;
  const step = (endPrice - startPrice) / 100; // 100 data points

  const plAtExpiration = [];
  const plCurrent = [];

  for (let price = startPrice; price <= endPrice; price += step) {
    plAtExpiration.push({
      stockPrice: price,
      pl: strategy.calculatePLAtExpiration(price)
    });

    plCurrent.push({
      stockPrice: price,
      pl: strategy.calculateCurrentPL(price)
    });
  }

  return {
    atExpiration: plAtExpiration,
    current: plCurrent
  };
}
