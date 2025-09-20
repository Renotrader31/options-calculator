// Professional Black-Scholes Options Pricing Engine
// Supports all Greeks and advanced calculations

class BlackScholesCalculator {
  constructor() {
    this.DAYS_PER_YEAR = 365;
    this.TRADING_DAYS_PER_YEAR = 252;
  }

  // Standard normal cumulative distribution function
  normalCDF(x) {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  // Standard normal probability density function
  normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  // Calculate d1 parameter for Black-Scholes
  calculateD1(S, K, T, r, sigma) {
    return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  }

  // Calculate d2 parameter for Black-Scholes
  calculateD2(d1, sigma, T) {
    return d1 - sigma * Math.sqrt(T);
  }

  // Black-Scholes Call Option Price
  callPrice(S, K, T, r, sigma) {
    if (T <= 0) return Math.max(S - K, 0);

    const d1 = this.calculateD1(S, K, T, r, sigma);
    const d2 = this.calculateD2(d1, sigma, T);

    return S * this.normalCDF(d1) - K * Math.exp(-r * T) * this.normalCDF(d2);
  }

  // Black-Scholes Put Option Price
  putPrice(S, K, T, r, sigma) {
    if (T <= 0) return Math.max(K - S, 0);

    const d1 = this.calculateD1(S, K, T, r, sigma);
    const d2 = this.calculateD2(d1, sigma, T);

    return K * Math.exp(-r * T) * this.normalCDF(-d2) - S * this.normalCDF(-d1);
  }

  // Delta - Price sensitivity to underlying price change
  delta(S, K, T, r, sigma, optionType) {
    if (T <= 0) {
      return optionType === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
    }

    const d1 = this.calculateD1(S, K, T, r, sigma);

    return optionType === 'call' ? this.normalCDF(d1) : this.normalCDF(d1) - 1;
  }

  // Gamma - Delta sensitivity to underlying price change
  gamma(S, K, T, r, sigma) {
    if (T <= 0) return 0;

    const d1 = this.calculateD1(S, K, T, r, sigma);
    return this.normalPDF(d1) / (S * sigma * Math.sqrt(T));
  }

  // Theta - Price sensitivity to time decay (per day)
  theta(S, K, T, r, sigma, optionType) {
    if (T <= 0) return 0;

    const d1 = this.calculateD1(S, K, T, r, sigma);
    const d2 = this.calculateD2(d1, sigma, T);

    const term1 = -(S * this.normalPDF(d1) * sigma) / (2 * Math.sqrt(T));

    if (optionType === 'call') {
      const term2 = r * K * Math.exp(-r * T) * this.normalCDF(d2);
      return (term1 - term2) / this.DAYS_PER_YEAR;
    } else {
      const term2 = r * K * Math.exp(-r * T) * this.normalCDF(-d2);
      return (term1 + term2) / this.DAYS_PER_YEAR;
    }
  }

  // Vega - Price sensitivity to volatility change
  vega(S, K, T, r, sigma) {
    if (T <= 0) return 0;

    const d1 = this.calculateD1(S, K, T, r, sigma);
    return S * this.normalPDF(d1) * Math.sqrt(T) / 100; // Per 1% volatility change
  }

  // Rho - Price sensitivity to interest rate change
  rho(S, K, T, r, sigma, optionType) {
    if (T <= 0) return 0;

    const d1 = this.calculateD1(S, K, T, r, sigma);
    const d2 = this.calculateD2(d1, sigma, T);

    if (optionType === 'call') {
      return K * T * Math.exp(-r * T) * this.normalCDF(d2) / 100;
    } else {
      return -K * T * Math.exp(-r * T) * this.normalCDF(-d2) / 100;
    }
  }

  // Calculate all Greeks at once
  calculateAllGreeks(S, K, T, r, sigma, optionType) {
    const price = optionType === 'call' ? 
      this.callPrice(S, K, T, r, sigma) : 
      this.putPrice(S, K, T, r, sigma);

    return {
      price: price,
      delta: this.delta(S, K, T, r, sigma, optionType),
      gamma: this.gamma(S, K, T, r, sigma),
      theta: this.theta(S, K, T, r, sigma, optionType),
      vega: this.vega(S, K, T, r, sigma),
      rho: this.rho(S, K, T, r, sigma, optionType)
    };
  }

  // Implied Volatility calculation using Newton-Raphson method
  impliedVolatility(marketPrice, S, K, T, r, optionType, tolerance = 0.0001, maxIterations = 100) {
    let sigma = 0.3; // Initial guess

    for (let i = 0; i < maxIterations; i++) {
      const price = optionType === 'call' ? 
        this.callPrice(S, K, T, r, sigma) : 
        this.putPrice(S, K, T, r, sigma);

      const diff = price - marketPrice;

      if (Math.abs(diff) < tolerance) {
        return sigma;
      }

      const vega = this.vega(S, K, T, r, sigma) * 100; // Convert back to decimal

      if (vega === 0) break;

      sigma = sigma - diff / vega;

      // Keep sigma in reasonable bounds
      sigma = Math.max(0.01, Math.min(5.0, sigma));
    }

    return sigma;
  }

  // Calculate time to expiration in years
  timeToExpiration(expirationDate) {
    const now = new Date();
    const expiry = new Date(expirationDate);
    const diffTime = expiry - now;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.max(0, diffDays / this.DAYS_PER_YEAR);
  }

  // Probability of profit calculation
  probabilityOfProfit(S, breakeven, T, sigma) {
    if (T <= 0) return S > breakeven ? 100 : 0;

    const logReturn = Math.log(breakeven / S);
    const drift = -0.5 * sigma * sigma * T;
    const diffusion = sigma * Math.sqrt(T);

    const z = (logReturn - drift) / diffusion;
    return (1 - this.normalCDF(z)) * 100;
  }
}

// Options Strategy Calculator
class OptionsStrategy {
  constructor() {
    this.bs = new BlackScholesCalculator();
    this.legs = [];
  }

  // Add option leg to strategy
  addLeg(type, strike, premium, quantity, optionType, expiration) {
    this.legs.push({
      type, // 'long' or 'short'
      strike: parseFloat(strike),
      premium: parseFloat(premium),
      quantity: parseInt(quantity),
      optionType, // 'call' or 'put'
      expiration
    });
  }

  // Clear all legs
  clearLegs() {
    this.legs = [];
  }

  // Calculate P&L at expiration for given stock price
  calculatePLAtExpiration(stockPrice) {
    let totalPL = 0;

    this.legs.forEach(leg => {
      let intrinsicValue = 0;

      if (leg.optionType === 'call') {
        intrinsicValue = Math.max(0, stockPrice - leg.strike);
      } else {
        intrinsicValue = Math.max(0, leg.strike - stockPrice);
      }

      let legPL = 0;
      if (leg.type === 'long') {
        legPL = (intrinsicValue - leg.premium) * leg.quantity * 100;
      } else {
        legPL = (leg.premium - intrinsicValue) * leg.quantity * 100;
      }

      totalPL += legPL;
    });

    return totalPL;
  }

  // Calculate current theoretical P&L
  calculateCurrentPL(stockPrice, riskFreeRate = 0.05, impliedVol = 0.25) {
    let totalPL = 0;

    this.legs.forEach(leg => {
      const T = this.bs.timeToExpiration(leg.expiration);

      const currentPrice = leg.optionType === 'call' ?
        this.bs.callPrice(stockPrice, leg.strike, T, riskFreeRate, impliedVol) :
        this.bs.putPrice(stockPrice, leg.strike, T, riskFreeRate, impliedVol);

      let legPL = 0;
      if (leg.type === 'long') {
        legPL = (currentPrice - leg.premium) * leg.quantity * 100;
      } else {
        legPL = (leg.premium - currentPrice) * leg.quantity * 100;
      }

      totalPL += legPL;
    });

    return totalPL;
  }

  // Calculate breakeven points
  calculateBreakevens() {
    const breakevens = [];

    // Sample stock prices to find zero crossings
    const minStrike = Math.min(...this.legs.map(leg => leg.strike));
    const maxStrike = Math.max(...this.legs.map(leg => leg.strike));

    const priceRange = Math.max(maxStrike - minStrike, 50);
    const startPrice = minStrike - priceRange * 0.5;
    const endPrice = maxStrike + priceRange * 0.5;

    let lastPL = null;

    for (let price = startPrice; price <= endPrice; price += 0.25) {
      const currentPL = this.calculatePLAtExpiration(price);

      if (lastPL !== null) {
        // Check for zero crossing
        if ((lastPL <= 0 && currentPL >= 0) || (lastPL >= 0 && currentPL <= 0)) {
          // Use binary search for more precision
          let low = price - 0.25;
          let high = price;

          while (high - low > 0.01) {
            const mid = (low + high) / 2;
            const midPL = this.calculatePLAtExpiration(mid);

            if (Math.abs(midPL) < 0.01) {
              breakevens.push(mid);
              break;
            }

            if ((lastPL <= 0 && midPL >= 0) || (lastPL >= 0 && midPL <= 0)) {
              high = mid;
            } else {
              low = mid;
              lastPL = midPL;
            }
          }
        }
      }

      lastPL = currentPL;
    }

    return [...new Set(breakevens.map(be => Math.round(be * 100) / 100))];
  }

  // Calculate maximum profit and loss
  calculateMaxProfitLoss() {
    let maxProfit = -Infinity;
    let maxLoss = Infinity;

    // Sample a wide range of stock prices
    const strikes = this.legs.map(leg => leg.strike);
    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);

    const priceRange = Math.max(maxStrike - minStrike, 100);
    const startPrice = Math.max(0.01, minStrike - priceRange);
    const endPrice = maxStrike + priceRange;

    for (let price = startPrice; price <= endPrice; price += 0.5) {
      const pl = this.calculatePLAtExpiration(price);
      maxProfit = Math.max(maxProfit, pl);
      maxLoss = Math.min(maxLoss, pl);
    }

    // Check extremes (very high and very low prices)
    const extremeLow = this.calculatePLAtExpiration(0.01);
    const extremeHigh = this.calculatePLAtExpiration(endPrice * 2);

    maxProfit = Math.max(maxProfit, extremeLow, extremeHigh);
    maxLoss = Math.min(maxLoss, extremeLow, extremeHigh);

    return {
      maxProfit: maxProfit === -Infinity ? null : maxProfit,
      maxLoss: maxLoss === Infinity ? null : maxLoss
    };
  }

  // Get strategy summary
  getStrategySummary(currentStockPrice, riskFreeRate = 0.05, impliedVol = 0.25) {
    const breakevens = this.calculateBreakevens();
    const { maxProfit, maxLoss } = this.calculateMaxProfitLoss();
    const currentPL = this.calculateCurrentPL(currentStockPrice, riskFreeRate, impliedVol);

    // Calculate total premium paid/received
    let totalPremium = 0;
    this.legs.forEach(leg => {
      if (leg.type === 'long') {
        totalPremium -= leg.premium * leg.quantity * 100;
      } else {
        totalPremium += leg.premium * leg.quantity * 100;
      }
    });

    return {
      breakevens,
      maxProfit,
      maxLoss,
      currentPL,
      totalPremium,
      riskRewardRatio: maxLoss ? Math.abs(maxProfit / maxLoss) : null,
      probabilityOfProfit: breakevens.length > 0 ? 
        this.bs.probabilityOfProfit(currentStockPrice, breakevens[0], 
          this.bs.timeToExpiration(this.legs[0]?.expiration), impliedVol) : null
    };
  }
}

export { BlackScholesCalculator, OptionsStrategy };
