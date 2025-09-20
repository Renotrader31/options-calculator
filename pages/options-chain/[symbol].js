// pages/api/options-chain/[symbol].js
// Dynamic Options Chain API Endpoint

/**
 * Dynamic Options Chain API
 * 
 * Fetches detailed options chain data for a specific symbol
 * Supports filtering by expiration date and strike price ranges
 * 
 * Route: /api/options-chain/[symbol]
 * Examples:
 * - /api/options-chain/AAPL
 * - /api/options-chain/AAPL?expiration=2024-01-19
 * - /api/options-chain/AAPL?minStrike=140&maxStrike=160
 */

// Cache for options chain data
const optionsCache = new Map();
const CACHE_DURATION = 300000; // 5 minutes cache for options data

/**
 * Get cached options data
 */
function getCachedOptions(key) {
  const cached = optionsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

/**
 * Set cached options data
 */
function setCachedOptions(key, data) {
  optionsCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Fetch options chain from FMP (Primary source)
 */
async function getFMPOptionsChain(symbol, expiration = null) {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    throw new Error('FMP API key not configured');
  }

  let url = `https://financialmodelingprep.com/api/v3/options-chain/${symbol}?apikey=${apiKey}`;
  if (expiration) {
    url += `&expiration=${expiration}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format from FMP');
  }

  return data;
}

/**
 * Fetch options chain from Polygon (Backup source)
 */
async function getPolygonOptionsChain(symbol, expiration = null) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error('Polygon API key not configured');
  }

  // Get options contracts
  let url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${symbol}&limit=1000&apikey=${apiKey}`;
  if (expiration) {
    url += `&expiration_date=${expiration}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }

  // Transform Polygon format to standard format
  return data.results.map(contract => ({
    contractSymbol: contract.ticker,
    strike: contract.strike_price,
    expiration: contract.expiration_date,
    optionType: contract.contract_type.toLowerCase(), // 'call' or 'put'
    lastPrice: null, // Would need separate API call for pricing
    bid: null,
    ask: null,
    volume: null,
    openInterest: null,
    impliedVolatility: null
  }));
}

/**
 * Filter options chain data
 */
function filterOptionsChain(data, filters) {
  let filtered = [...data];

  // Filter by expiration date
  if (filters.expiration) {
    filtered = filtered.filter(opt => opt.expiration === filters.expiration);
  }

  // Filter by strike range
  if (filters.minStrike !== undefined) {
    filtered = filtered.filter(opt => opt.strike >= parseFloat(filters.minStrike));
  }

  if (filters.maxStrike !== undefined) {
    filtered = filtered.filter(opt => opt.strike <= parseFloat(filters.maxStrike));
  }

  // Filter by option type
  if (filters.optionType) {
    const type = filters.optionType.toLowerCase();
    if (type === 'calls' || type === 'call') {
      filtered = filtered.filter(opt => opt.optionType === 'call');
    } else if (type === 'puts' || type === 'put') {
      filtered = filtered.filter(opt => opt.optionType === 'put');
    }
  }

  // Filter by minimum volume
  if (filters.minVolume !== undefined) {
    filtered = filtered.filter(opt => (opt.volume || 0) >= parseInt(filters.minVolume));
  }

  return filtered;
}

/**
 * Organize options data into structured format
 */
function organizeOptionsData(data, currentPrice = null) {
  // Group by expiration date
  const expirations = {};

  data.forEach(option => {
    const expDate = option.expiration;

    if (!expirations[expDate]) {
      expirations[expDate] = {
        expiration: expDate,
        daysToExpiry: calculateDaysToExpiry(expDate),
        calls: [],
        puts: []
      };
    }

    // Add moneyness calculation if current price is available
    if (currentPrice) {
      option.moneyness = option.strike / currentPrice;
      option.intrinsicValue = option.optionType === 'call' ? 
        Math.max(currentPrice - option.strike, 0) :
        Math.max(option.strike - currentPrice, 0);
      option.timeValue = (option.lastPrice || 0) - option.intrinsicValue;
    }

    if (option.optionType === 'call') {
      expirations[expDate].calls.push(option);
    } else {
      expirations[expDate].puts.push(option);
    }
  });

  // Sort strikes within each expiration
  Object.values(expirations).forEach(exp => {
    exp.calls.sort((a, b) => a.strike - b.strike);
    exp.puts.sort((a, b) => a.strike - b.strike);
  });

  return expirations;
}

/**
 * Calculate days to expiry
 */
function calculateDaysToExpiry(expirationDate) {
  const expiry = new Date(expirationDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(diffDays, 0);
}

/**
 * Get current stock price for context
 */
async function getCurrentStockPrice(symbol) {
  try {
    // Try to get current price from market data API
    const marketDataUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/market-data?symbol=${symbol}&type=quote`;
    const response = await fetch(marketDataUrl);

    if (response.ok) {
      const data = await response.json();
      return data.data?.price || null;
    }
  } catch (error) {
    console.warn('Could not fetch current stock price:', error.message);
  }

  return null;
}

/**
 * Calculate basic option metrics
 */
function calculateOptionMetrics(optionsData, currentPrice) {
  if (!currentPrice) return optionsData;

  return optionsData.map(option => {
    const { strike, optionType, lastPrice = 0, expiration } = option;
    const daysToExpiry = calculateDaysToExpiry(expiration);
    const timeToExpiry = daysToExpiry / 365;

    // Calculate moneyness
    const moneyness = strike / currentPrice;
    const isITM = optionType === 'call' ? currentPrice > strike : currentPrice < strike;
    const isATM = Math.abs(currentPrice - strike) / currentPrice < 0.05; // Within 5%

    // Calculate intrinsic and time value
    const intrinsicValue = optionType === 'call' ? 
      Math.max(currentPrice - strike, 0) :
      Math.max(strike - currentPrice, 0);
    const timeValue = Math.max(lastPrice - intrinsicValue, 0);

    return {
      ...option,
      moneyness,
      isITM,
      isATM,
      isOTM: !isITM && !isATM,
      intrinsicValue,
      timeValue,
      daysToExpiry,
      timeToExpiry
    };
  });
}

/**
 * Main API Handler
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    const { symbol } = req.query;
    const { 
      expiration, 
      minStrike, 
      maxStrike, 
      optionType, 
      minVolume,
      format = 'grouped' // 'grouped' or 'flat'
    } = req.query;

    // Validate symbol
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        error: 'Invalid symbol',
        message: 'Symbol parameter is required'
      });
    }

    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `options_${upperSymbol}_${JSON.stringify(req.query)}`;

    // Check cache first
    const cachedData = getCachedOptions(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        success: true,
        cached: true,
        timestamp: new Date().toISOString(),
        ...cachedData
      });
    }

    let optionsData = [];
    let dataSource = null;
    let currentPrice = null;

    // Get current stock price for context
    currentPrice = await getCurrentStockPrice(upperSymbol);

    // Try to fetch options data from providers
    try {
      // Try FMP first (better options data)
      optionsData = await getFMPOptionsChain(upperSymbol, expiration);
      dataSource = 'fmp';

      console.log(`Fetched ${optionsData.length} options from FMP for ${upperSymbol}`);

    } catch (fmpError) {
      console.warn('FMP options chain failed:', fmpError.message);

      try {
        // Fallback to Polygon
        optionsData = await getPolygonOptionsChain(upperSymbol, expiration);
        dataSource = 'polygon';

        console.log(`Fetched ${optionsData.length} options from Polygon for ${upperSymbol}`);

      } catch (polygonError) {
        console.warn('Polygon options chain failed:', polygonError.message);

        // Return empty data with message
        const emptyResponse = {
          success: true,
          symbol: upperSymbol,
          currentPrice,
          message: 'Options chain data not available',
          error: `All providers failed: FMP (${fmpError.message}), Polygon (${polygonError.message})`,
          data: format === 'grouped' ? {} : [],
          metadata: {
            symbol: upperSymbol,
            timestamp: new Date().toISOString(),
            source: 'none',
            totalContracts: 0
          }
        };

        return res.status(200).json(emptyResponse);
      }
    }

    // Filter the data based on query parameters
    const filters = { expiration, minStrike, maxStrike, optionType, minVolume };
    const filteredData = filterOptionsChain(optionsData, filters);

    // Calculate option metrics
    const enhancedData = calculateOptionMetrics(filteredData, currentPrice);

    // Format the response
    let formattedData;
    if (format === 'grouped') {
      formattedData = organizeOptionsData(enhancedData, currentPrice);
    } else {
      formattedData = enhancedData;
    }

    // Extract unique expiration dates for metadata
    const expirations = [...new Set(enhancedData.map(opt => opt.expiration))].sort();

    const response = {
      success: true,
      symbol: upperSymbol,
      currentPrice,
      data: formattedData,
      metadata: {
        symbol: upperSymbol,
        timestamp: new Date().toISOString(),
        source: dataSource,
        totalContracts: enhancedData.length,
        expirations,
        filters: Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null)
        ),
        format
      }
    };

    // Cache the successful result
    setCachedOptions(cacheKey, response);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Options Chain API Error:', error);

    return res.status(500).json({
      error: 'Options chain unavailable',
      message: error.message,
      timestamp: new Date().toISOString(),
      symbol: req.query.symbol?.toUpperCase()
    });
  }
}

/**
 * API Documentation
 * 
 * GET /api/options-chain/[symbol]
 * 
 * Parameters:
 * - symbol: Stock symbol (from URL path)
 * - expiration: Filter by expiration date (YYYY-MM-DD)
 * - minStrike: Minimum strike price
 * - maxStrike: Maximum strike price  
 * - optionType: Filter by 'calls' or 'puts'
 * - minVolume: Minimum volume filter
 * - format: 'grouped' (default) or 'flat'
 * 
 * Examples:
 * - /api/options-chain/AAPL
 * - /api/options-chain/AAPL?expiration=2024-01-19&optionType=calls
 * - /api/options-chain/TSLA?minStrike=200&maxStrike=250&format=flat
 * 
 * Response (grouped format):
 * {
 *   "success": true,
 *   "symbol": "AAPL",
 *   "currentPrice": 150.00,
 *   "data": {
 *     "2024-01-19": {
 *       "expiration": "2024-01-19",
 *       "daysToExpiry": 30,
 *       "calls": [...],
 *       "puts": [...]
 *     }
 *   },
 *   "metadata": {
 *     "totalContracts": 100,
 *     "expirations": ["2024-01-19", "2024-02-16"],
 *     "source": "fmp"
 *   }
 * }
 */
