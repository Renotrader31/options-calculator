// pages/api/calculate/index.js
// Options Calculator API - Black-Scholes Pricing and Greeks Calculations

/**
 * Options Calculator API Endpoint
 * 
 * Handles options pricing calculations using Black-Scholes model
 * Supports multiple options strategies and returns comprehensive analysis
 * 
 * @param {Object} req - Request object containing calculation parameters
 * @param {Object} res - Response object
 */

// Black-Scholes mathematical functions
function normalCDF(x) {
  // Approximation of cumulative standard normal distribution
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x) {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

/**
 * Black-Scholes Option Pricing Functions
 */
function blackScholesCall(S, K, T, r, sigma) {
  if (T <= 0) return Math.max(S - K, 0);

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  return Math.max(callPrice, 0);
}

function blackScholesPut(S, K, T, r, sigma) {
  if (T <= 0) return Math.max(K - S, 0);

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const putPrice = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  return Math.max(putPrice, 0);
}

/**
 * Greeks Calculations
 */
function calculateGreeks(S, K, T, r, sigma, optionType) {
  if (T <= 0) {
    return {
      delta: optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    };
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  // Delta
  const delta = optionType === 'call' ? 
    normalCDF(d1) : 
    normalCDF(d1) - 1;

  // Gamma
  const gamma = normalPDF(d1) / (S * sigma * Math.sqrt(T));

  // Theta
  const theta = optionType === 'call' ?
    (-S * normalPDF(d1) * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365 :
    (-S * normalPDF(d1) * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;

  // Vega
  const vega = S * normalPDF(d1) * Math.sqrt(T) / 100;

  // Rho
  const rho = optionType === 'call' ?
    K * T * Math.exp(-r * T) * normalCDF(d2) / 100 :
    -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;

  return { delta, gamma, theta, vega, rho };
}

/**
 * Strategy Calculation Functions
 */
function calculateSingleOption(params) {
  const { stockPrice, strike, timeToExpiry, riskFreeRate, volatility, optionType, position, premium, quantity } = params;

  // Calculate theoretical price
  const theoreticalPrice = optionType === 'call' ?
    blackScholesCall(stockPrice, strike, timeToExpiry, riskFreeRate, volatility) :
    blackScholesPut(stockPrice, strike, timeToExpiry, riskFreeRate, volatility);

  // Calculate Greeks
  const greeks = calculateGreeks(stockPrice, strike, timeToExpiry, riskFreeRate, volatility, optionType);

  // Calculate P&L
  const costBasis = premium * quantity * (position === 'long' ? 1 : -1);
  const currentValue = theoreticalPrice * quantity * (position === 'long' ? 1 : -1);
  const unrealizedPL = currentValue - costBasis;

  // Calculate breakeven
  const breakeven = optionType === 'call' ?
    (position === 'long' ? strike + premium : strike - premium) :
    (position === 'long' ? strike - premium : strike + premium);

  return {
    theoreticalPrice,
    greeks: {
      delta: greeks.delta * quantity * (position === 'long' ? 1 : -1),
      gamma: greeks.gamma * quantity * (position === 'long' ? 1 : -1),
      theta: greeks.theta * quantity * (position === 'long' ? 1 : -1),
      vega: greeks.vega * quantity * (position === 'long' ? 1 : -1),
      rho: greeks.rho * quantity * (position === 'long' ? 1 : -1)
    },
    pnl: {
      costBasis,
      currentValue,
      unrealizedPL,
      unrealizedPLPercent: costBasis !== 0 ? (unrealizedPL / Math.abs(costBasis)) * 100 : 0
    },
    breakeven,
    maxProfit: position === 'long' ? 
      (optionType === 'call' ? Infinity : (strike - premium) * quantity) :
      premium * quantity,
    maxLoss: position === 'long' ?
      premium * quantity :
      (optionType === 'call' ? Infinity : (premium - strike) * quantity)
  };
}

function calculateSpread(params) {
  const { legs, stockPrice, riskFreeRate } = params;

  let totalCost = 0;
  let totalGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  let legDetails = [];

  legs.forEach((leg, index) => {
    const legCalc = calculateSingleOption({
      ...leg,
      stockPrice,
      riskFreeRate
    });

    legDetails.push({
      leg: index + 1,
      ...leg,
      ...legCalc
    });

    totalCost += legCalc.pnl.costBasis;
    totalGreeks.delta += legCalc.greeks.delta;
    totalGreeks.gamma += legCalc.greeks.gamma;
    totalGreeks.theta += legCalc.greeks.theta;
    totalGreeks.vega += legCalc.greeks.vega;
    totalGreeks.rho += legCalc.greeks.rho;
  });

  return {
    legs: legDetails,
    strategy: {
      totalCost,
      totalGreeks,
      netCredit: totalCost < 0,
      netDebit: totalCost > 0
    }
  };
}

/**
 * Input Validation Function
 */
function validateInput(params) {
  const errors = [];

  if (!params.stockPrice || params.stockPrice <= 0) {
    errors.push('Stock price must be positive');
  }

  if (!params.strategy) {
    errors.push('Strategy type is required');
  }

  if (params.strategy === 'single' && params.legs?.length !== 1) {
    errors.push('Single option strategy must have exactly 1 leg');
  }

  if (params.legs) {
    params.legs.forEach((leg, index) => {
      if (!leg.strike || leg.strike <= 0) {
        errors.push(`Leg ${index + 1}: Strike price must be positive`);
      }

      if (!leg.timeToExpiry || leg.timeToExpiry < 0) {
        errors.push(`Leg ${index + 1}: Time to expiry must be non-negative`);
      }

      if (!leg.volatility || leg.volatility <= 0) {
        errors.push(`Leg ${index + 1}: Volatility must be positive`);
      }

      if (!leg.premium || leg.premium < 0) {
        errors.push(`Leg ${index + 1}: Premium must be non-negative`);
      }

      if (!['call', 'put'].includes(leg.optionType)) {
        errors.push(`Leg ${index + 1}: Option type must be 'call' or 'put'`);
      }

      if (!['long', 'short'].includes(leg.position)) {
        errors.push(`Leg ${index + 1}: Position must be 'long' or 'short'`);
      }
    });
  }

  return errors;
}

/**
 * Main API Handler
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const params = req.body;

    // Validate input
    const validationErrors = validateInput(params);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    let result;

    // Route to appropriate calculation function
    switch (params.strategy) {
      case 'single':
        result = calculateSingleOption(params.legs[0]);
        break;

      case 'spread':
      case 'straddle':
      case 'strangle':
      case 'iron_condor':
      case 'iron_butterfly':
        result = calculateSpread(params);
        break;

      default:
        return res.status(400).json({
          error: 'Unsupported strategy',
          message: `Strategy '${params.strategy}' is not supported`
        });
    }

    // Add metadata to response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      input: {
        strategy: params.strategy,
        stockPrice: params.stockPrice,
        legs: params.legs?.length || 0
      },
      result,
      calculations: {
        model: 'Black-Scholes',
        riskFreeRate: params.riskFreeRate || 0.05
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Calculation API Error:', error);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred during calculation',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * API Documentation
 * 
 * POST /api/calculate
 * 
 * Request Body:
 * {
 *   "strategy": "single" | "spread" | "straddle" | "strangle" | "iron_condor",
 *   "stockPrice": number,
 *   "riskFreeRate": number (optional, default: 0.05),
 *   "legs": [
 *     {
 *       "optionType": "call" | "put",
 *       "position": "long" | "short",
 *       "strike": number,
 *       "premium": number,
 *       "timeToExpiry": number (years),
 *       "volatility": number (decimal, e.g., 0.20 for 20%),
 *       "quantity": number (default: 1)
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "timestamp": "ISO date string",
 *   "input": { ... },
 *   "result": {
 *     "theoreticalPrice": number,
 *     "greeks": { "delta": number, "gamma": number, ... },
 *     "pnl": { "unrealizedPL": number, ... },
 *     "breakeven": number,
 *     "maxProfit": number,
 *     "maxLoss": number
 *   }
 * }
 */
