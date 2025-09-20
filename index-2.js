// API Route: /api/market-data
// Handles real-time market data fetching

import MarketDataClient from '../../../lib/apiClients.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol, dataType = 'quote', expiration = null } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const client = new MarketDataClient();

    switch (dataType) {
      case 'quote':
        return await handleQuote(symbol, client, res);

      case 'options-chain':
        if (!expiration) {
          return res.status(400).json({ error: 'Expiration date required for options chain' });
        }
        return await handleOptionsChain(symbol, expiration, client, res);

      case 'volatility':
        return await handleVolatility(symbol, client, res);

      default:
        return res.status(400).json({ error: 'Invalid data type' });
    }

  } catch (error) {
    console.error('Market data error:', error);
    return res.status(500).json({ 
      error: 'Market data fetch failed', 
      details: error.message 
    });
  }
}

async function handleQuote(symbol, client, res) {
  try {
    const quote = await client.getBestQuote(symbol.toUpperCase());

    return res.status(200).json({
      success: true,
      data: {
        symbol: quote.symbol,
        price: quote.price,
        change: quote.change || null,
        changePercent: quote.changePercent || null,
        volume: quote.volume || null,
        marketCap: quote.marketCap || null,
        provider: quote.provider,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch quote data',
      details: error.message,
      fallback: {
        symbol: symbol.toUpperCase(),
        price: null,
        note: 'Please enter price manually or check API keys'
      }
    });
  }
}

async function handleOptionsChain(symbol, expiration, client, res) {
  try {
    const chain = await client.getBestOptionsChain(symbol.toUpperCase(), expiration);

    // Group by strike and type for easier frontend consumption
    const groupedChain = chain.reduce((acc, option) => {
      const key = option.strike;
      if (!acc[key]) {
        acc[key] = { strike: key, calls: [], puts: [] };
      }

      if (option.type === 'CALL' || option.type === 'call') {
        acc[key].calls.push(option);
      } else {
        acc[key].puts.push(option);
      }

      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        expiration,
        chain: Object.values(groupedChain).sort((a, b) => a.strike - b.strike),
        totalContracts: chain.length,
        provider: chain[0]?.provider || 'unknown'
      }
    });
  } catch (error) {
    return res.status(503).json({
      error: 'Unable to fetch options chain',
      details: error.message,
      fallback: {
        symbol: symbol.toUpperCase(),
        expiration,
        note: 'Options chain not available. Please enter option details manually.'
      }
    });
  }
}

async function handleVolatility(symbol, client, res) {
  try {
    // Try to get historical volatility from Alpha Vantage
    const volatilityData = await client.getAlphaVantageHistoricalVolatility(symbol.toUpperCase());

    return res.status(200).json({
      success: true,
      data: {
        symbol: volatilityData.symbol,
        historicalVolatility: volatilityData.volatility,
        period: volatilityData.period,
        annualizedPercentage: (volatilityData.volatility * 100).toFixed(2) + '%',
        provider: volatilityData.provider
      }
    });
  } catch (error) {
    // Fallback to typical volatility estimates by asset class
    const fallbackVolatility = getFallbackVolatility(symbol);

    return res.status(200).json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        historicalVolatility: fallbackVolatility,
        period: 'estimated',
        annualizedPercentage: (fallbackVolatility * 100).toFixed(2) + '%',
        provider: 'fallback',
        note: 'Estimated volatility based on asset class. Consider using real-time data.'
      }
    });
  }
}

function getFallbackVolatility(symbol) {
  const sym = symbol.toUpperCase();

  // Major indices - typically lower volatility
  if (['SPY', 'QQQ', 'DIA', 'IWM'].includes(sym)) {
    return 0.20; // 20%
  }

  // Tech stocks - typically higher volatility
  if (['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NFLX'].includes(sym)) {
    return 0.35; // 35%
  }

  // Crypto-related or high-volatility stocks
  if (['COIN', 'MSTR', 'RIOT', 'MARA'].includes(sym)) {
    return 0.60; // 60%
  }

  // Default for most stocks
  return 0.30; // 30%
}
