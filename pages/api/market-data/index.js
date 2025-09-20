// pages/api/market-data/index.js
// Multi-Provider Market Data API with Intelligent Failover

/**
 * Market Data API Endpoint
 * 
 * Fetches real-time market data from multiple providers with intelligent failover:
 * 1. Polygon (Premium/Paid) - Primary source for real-time data
 * 2. Financial Modeling Prep (FMP) - Secondary source 
 * 3. Alpha Vantage (Free) - Backup source
 * 4. Twelve Data (Free) - Additional backup
 * 
 * Features:
 * - Intelligent API rotation based on rate limits
 * - Caching to reduce API calls
 * - Historical volatility calculations
 * - Error recovery with graceful fallbacks
 */

// Cache to reduce API calls
const cache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

// Rate limiting tracker
const rateLimits = {
  polygon: { count: 0, resetTime: 0, limit: 5000 }, // Per minute
  fmp: { count: 0, resetTime: 0, limit: 300 },     // Per minute  
  alphavantage: { count: 0, resetTime: 0, limit: 5 }, // Per minute
  twelvedata: { count: 0, resetTime: 0, limit: 8 }    // Per minute
};

/**
 * Check if API is within rate limits
 */
function canUseAPI(provider) {
  const now = Date.now();
  const limits = rateLimits[provider];

  // Reset counter if minute has passed
  if (now > limits.resetTime) {
    limits.count = 0;
    limits.resetTime = now + 60000; // Next minute
  }

  return limits.count < limits.limit;
}

/**
 * Update rate limit counter
 */
function updateRateLimit(provider) {
  rateLimits[provider].count++;
}

/**
 * Get cached data if available and not expired
 */
function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

/**
 * Set cache data
 */
function setCacheData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Polygon API Client
 */
async function getPolygonData(symbol) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error('Polygon API key not configured');

  updateRateLimit('polygon');

  // Get real-time quote
  const quoteResponse = await fetch(
    `https://api.polygon.io/v2/last/trade/${symbol}?apikey=${apiKey}`
  );

  if (!quoteResponse.ok) {
    throw new Error(`Polygon API error: ${quoteResponse.status}`);
  }

  const quoteData = await quoteResponse.json();

  // Get previous close for change calculation
  const prevCloseResponse = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apikey=${apiKey}`
  );

  const prevCloseData = await prevCloseResponse.json();
  const prevClose = prevCloseData.results?.[0]?.c || quoteData.results?.p || 0;

  return {
    symbol: symbol,
    price: quoteData.results?.p || 0,
    change: quoteData.results?.p ? quoteData.results.p - prevClose : 0,
    changePercent: prevClose ? ((quoteData.results?.p - prevClose) / prevClose) * 100 : 0,
    volume: quoteData.results?.s || 0,
    timestamp: new Date(quoteData.results?.t || Date.now()).toISOString(),
    source: 'polygon',
    bid: null,
    ask: null,
    high: null,
    low: null
  };
}

/**
 * Financial Modeling Prep API Client
 */
async function getFMPData(symbol) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) throw new Error('FMP API key not configured');

  updateRateLimit('fmp');

  const response = await fetch(
    `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status}`);
  }

  const data = await response.json();
  const quote = data[0];

  if (!quote) {
    throw new Error('No data returned from FMP');
  }

  return {
    symbol: quote.symbol,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changesPercentage,
    volume: quote.volume,
    timestamp: new Date().toISOString(),
    source: 'fmp',
    bid: quote.bid,
    ask: quote.ask,
    high: quote.dayHigh,
    low: quote.dayLow
  };
}

/**
 * Alpha Vantage API Client
 */
async function getAlphaVantageData(symbol) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error('Alpha Vantage API key not configured');

  updateRateLimit('alphavantage');

  const response = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Alpha Vantage API error: ${response.status}`);
  }

  const data = await response.json();
  const quote = data['Global Quote'];

  if (!quote || Object.keys(quote).length === 0) {
    throw new Error('No data returned from Alpha Vantage');
  }

  return {
    symbol: quote['01. symbol'],
    price: parseFloat(quote['05. price']),
    change: parseFloat(quote['09. change']),
    changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
    volume: parseInt(quote['06. volume']),
    timestamp: new Date().toISOString(),
    source: 'alphavantage',
    bid: null,
    ask: null,
    high: parseFloat(quote['03. high']),
    low: parseFloat(quote['04. low'])
  };
}

/**
 * Twelve Data API Client
 */
async function getTwelveDataQuote(symbol) {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error('Twelve Data API key not configured');

  updateRateLimit('twelvedata');

  const response = await fetch(
    `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status}`);
  }

  const quote = await response.json();

  if (quote.status === 'error') {
    throw new Error(`Twelve Data error: ${quote.message}`);
  }

  return {
    symbol: quote.symbol,
    price: parseFloat(quote.close),
    change: parseFloat(quote.close) - parseFloat(quote.previous_close),
    changePercent: ((parseFloat(quote.close) - parseFloat(quote.previous_close)) / parseFloat(quote.previous_close)) * 100,
    volume: parseInt(quote.volume) || 0,
    timestamp: new Date().toISOString(),
    source: 'twelvedata',
    bid: null,
    ask: null,
    high: parseFloat(quote.high),
    low: parseFloat(quote.low)
  };
}

/**
 * Calculate Historical Volatility
 */
async function calculateHistoricalVolatility(symbol, days = 30) {
  // This is a simplified implementation
  // In production, you'd fetch historical prices and calculate properly

  try {
    // Try to get historical data from FMP (has good historical endpoints)
    if (process.env.FMP_API_KEY && canUseAPI('fmp')) {
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?timeseries=${days}&apikey=${process.env.FMP_API_KEY}`
      );

      if (response.ok) {
        const data = await response.json();
        const prices = data.historical?.slice(0, days).map(d => d.close) || [];

        if (prices.length > 1) {
          // Calculate daily returns
          const returns = [];
          for (let i = 1; i < prices.length; i++) {
            returns.push(Math.log(prices[i] / prices[i-1]));
          }

          // Calculate standard deviation
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
          const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
          const dailyVol = Math.sqrt(variance);
          const annualizedVol = dailyVol * Math.sqrt(252); // 252 trading days

          return annualizedVol;
        }
      }
    }
  } catch (error) {
    console.warn('Could not calculate historical volatility:', error.message);
  }

  // Default fallback volatility estimates by symbol type
  const defaultVolatility = {
    'SPY': 0.15,
    'QQQ': 0.20,
    'AAPL': 0.25,
    'TSLA': 0.45,
    'MSFT': 0.22,
    'GOOGL': 0.25,
    'AMZN': 0.28
  };

  return defaultVolatility[symbol.toUpperCase()] || 0.25; // Default 25% volatility
}

/**
 * Main function to get market data with failover
 */
async function getMarketData(symbol, includeVolatility = false) {
  const cacheKey = `quote_${symbol}`;

  // Check cache first
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const providers = [
    { name: 'polygon', fn: getPolygonData },
    { name: 'fmp', fn: getFMPData },
    { name: 'alphavantage', fn: getAlphaVantageData },
    { name: 'twelvedata', fn: getTwelveDataQuote }
  ];

  let lastError = null;

  // Try each provider in order
  for (const provider of providers) {
    try {
      // Skip if rate limited
      if (!canUseAPI(provider.name)) {
        console.warn(`Rate limited for ${provider.name}, skipping`);
        continue;
      }

      console.log(`Trying ${provider.name} for ${symbol}`);
      const data = await provider.fn(symbol);

      // Add historical volatility if requested
      if (includeVolatility) {
        data.historicalVolatility = await calculateHistoricalVolatility(symbol);
      }

      // Cache the successful result
      setCacheData(cacheKey, data);

      return data;

    } catch (error) {
      console.warn(`${provider.name} failed for ${symbol}:`, error.message);
      lastError = error;
      continue;
    }
  }

  // If all providers failed, throw the last error
  throw new Error(`All market data providers failed. Last error: ${lastError?.message}`);
}

/**
 * Get Options Chain Data (simplified - mainly from FMP)
 */
async function getOptionsChain(symbol, expiration = null) {
  const cacheKey = `options_${symbol}_${expiration || 'all'}`;

  // Check cache first
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Try FMP first (has options data)
  if (process.env.FMP_API_KEY && canUseAPI('fmp')) {
    try {
      updateRateLimit('fmp');

      let url = `https://financialmodelingprep.com/api/v3/options-chain/${symbol}?apikey=${process.env.FMP_API_KEY}`;
      if (expiration) {
        url += `&expiration=${expiration}`;
      }

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();

        // Process and structure the options data
        const processedData = {
          symbol,
          timestamp: new Date().toISOString(),
          expirations: [],
          chains: data || []
        };

        // Extract unique expiration dates
        const expirations = [...new Set(data.map(opt => opt.expiration))].sort();
        processedData.expirations = expirations;

        setCacheData(cacheKey, processedData);
        return processedData;
      }
    } catch (error) {
      console.warn('FMP options chain failed:', error.message);
    }
  }

  // If options data not available, return empty structure
  return {
    symbol,
    timestamp: new Date().toISOString(),
    expirations: [],
    chains: [],
    message: 'Options chain data not available'
  };
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

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  try {
    const { symbol, type = 'quote', expiration, includeVolatility } = req.query;

    // Validate symbol
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Symbol parameter is required'
      });
    }

    const upperSymbol = symbol.toUpperCase();
    let result;

    switch (type) {
      case 'quote':
        result = await getMarketData(upperSymbol, includeVolatility === 'true');
        break;

      case 'options':
        result = await getOptionsChain(upperSymbol, expiration);
        break;

      default:
        return res.status(400).json({
          error: 'Invalid type',
          message: 'Type must be "quote" or "options"'
        });
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result,
      metadata: {
        symbol: upperSymbol,
        type,
        cached: result.source ? false : true
      }
    });

  } catch (error) {
    console.error('Market Data API Error:', error);

    return res.status(500).json({
      error: 'Market data unavailable',
      message: error.message,
      timestamp: new Date().toISOString(),
      suggestion: 'Check API keys and rate limits'
    });
  }
}

/**
 * API Documentation
 * 
 * GET /api/market-data?symbol=AAPL&type=quote&includeVolatility=true
 * GET /api/market-data?symbol=AAPL&type=options&expiration=2024-01-19
 * 
 * Parameters:
 * - symbol: Stock symbol (required)
 * - type: "quote" or "options" (default: "quote")
 * - includeVolatility: Include historical volatility calculation (default: false)
 * - expiration: Options expiration date (YYYY-MM-DD format, optional)
 * 
 * Response:
 * {
 *   "success": true,
 *   "timestamp": "ISO date string",
 *   "data": {
 *     "symbol": "AAPL",
 *     "price": 150.00,
 *     "change": 2.50,
 *     "changePercent": 1.69,
 *     "volume": 50000000,
 *     "source": "polygon",
 *     "historicalVolatility": 0.25
 *   }
 * }
 */
