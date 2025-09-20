// Market Data API Clients for Options Calculator
import axios from 'axios';

class MarketDataClient {
  constructor() {
    this.polygonApiKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY || process.env.POLYGON_API_KEY;
    this.fmpApiKey = process.env.NEXT_PUBLIC_FMP_API_KEY || process.env.FMP_API_KEY;
    this.alphaVantageApiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY;
    this.twelveDataApiKey = process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY || process.env.TWELVE_DATA_API_KEY;
  }

  // Polygon API (Premium) - Real-time data, options chains
  async getPolygonQuote(symbol) {
    try {
      const response = await axios.get(`https://api.polygon.io/v2/last/trade/${symbol}`, {
        params: { apikey: this.polygonApiKey }
      });
      return {
        symbol,
        price: response.data.results.p,
        timestamp: response.data.results.t,
        volume: response.data.results.s,
        provider: 'polygon'
      };
    } catch (error) {
      console.error('Polygon API error:', error);
      throw new Error(`Polygon API failed: ${error.message}`);
    }
  }

  async getPolygonOptionsChain(symbol, expiration) {
    try {
      const response = await axios.get(`https://api.polygon.io/v3/reference/options/contracts`, {
        params: {
          'underlying_ticker': symbol,
          'expiration_date': expiration,
          'limit': 1000,
          'apikey': this.polygonApiKey
        }
      });
      return response.data.results.map(option => ({
        contractSymbol: option.ticker,
        strike: option.strike_price,
        expiration: option.expiration_date,
        type: option.contract_type === 'call' ? 'CALL' : 'PUT',
        lastPrice: null, // Need separate call for pricing
        impliedVolatility: null,
        provider: 'polygon'
      }));
    } catch (error) {
      console.error('Polygon options chain error:', error);
      throw new Error(`Polygon options chain failed: ${error.message}`);
    }
  }

  // Financial Modeling Prep API
  async getFMPQuote(symbol) {
    try {
      const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${symbol}`, {
        params: { apikey: this.fmpApiKey }
      });
      const data = response.data[0];
      return {
        symbol,
        price: data.price,
        change: data.change,
        changePercent: data.changesPercentage,
        volume: data.volume,
        marketCap: data.marketCap,
        provider: 'fmp'
      };
    } catch (error) {
      console.error('FMP API error:', error);
      throw new Error(`FMP API failed: ${error.message}`);
    }
  }

  async getFMPOptionsChain(symbol) {
    try {
      const response = await axios.get(`https://financialmodelingprep.com/api/v3/options/${symbol}`, {
        params: { apikey: this.fmpApiKey }
      });
      return response.data.map(option => ({
        contractSymbol: option.contractSymbol,
        strike: option.strike,
        expiration: option.expiration,
        type: option.type,
        lastPrice: option.lastPrice,
        bid: option.bid,
        ask: option.ask,
        impliedVolatility: option.impliedVolatility,
        volume: option.volume,
        openInterest: option.openInterest,
        provider: 'fmp'
      }));
    } catch (error) {
      console.error('FMP options error:', error);
      throw new Error(`FMP options failed: ${error.message}`);
    }
  }

  // Alpha Vantage API (Free tier)
  async getAlphaVantageQuote(symbol) {
    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol: symbol,
          apikey: this.alphaVantageApiKey
        }
      });
      const data = response.data['Global Quote'];
      return {
        symbol,
        price: parseFloat(data['05. price']),
        change: parseFloat(data['09. change']),
        changePercent: data['10. change percent'].replace('%', ''),
        volume: parseInt(data['06. volume']),
        provider: 'alphavantage'
      };
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
      throw new Error(`Alpha Vantage API failed: ${error.message}`);
    }
  }

  async getAlphaVantageHistoricalVolatility(symbol, period = 30) {
    try {
      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: 'TIME_SERIES_DAILY',
          symbol: symbol,
          apikey: this.alphaVantageApiKey,
          outputsize: 'compact'
        }
      });

      const timeSeries = response.data['Time Series (Daily)'];
      const prices = Object.values(timeSeries)
        .slice(0, period)
        .map(day => parseFloat(day['4. close']));

      // Calculate historical volatility (annualized)
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push(Math.log(prices[i] / prices[i - 1]));
      }

      const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance * 252); // Annualized (252 trading days)

      return {
        symbol,
        volatility,
        period,
        provider: 'alphavantage'
      };
    } catch (error) {
      console.error('Alpha Vantage volatility error:', error);
      throw new Error(`Alpha Vantage volatility calculation failed: ${error.message}`);
    }
  }

  // Twelve Data API (Free tier)
  async getTwelveDataQuote(symbol) {
    try {
      const response = await axios.get(`https://api.twelvedata.com/quote`, {
        params: {
          symbol: symbol,
          apikey: this.twelveDataApiKey
        }
      });
      return {
        symbol,
        price: parseFloat(response.data.close),
        high: parseFloat(response.data.high),
        low: parseFloat(response.data.low),
        volume: parseInt(response.data.volume),
        change: parseFloat(response.data.change),
        changePercent: parseFloat(response.data.percent_change),
        provider: 'twelvedata'
      };
    } catch (error) {
      console.error('Twelve Data API error:', error);
      throw new Error(`Twelve Data API failed: ${error.message}`);
    }
  }

  async getTwelveDataTimeSeries(symbol, interval = '1day', outputsize = 30) {
    try {
      const response = await axios.get(`https://api.twelvedata.com/time_series`, {
        params: {
          symbol: symbol,
          interval: interval,
          outputsize: outputsize,
          apikey: this.twelveDataApiKey
        }
      });
      return {
        symbol,
        data: response.data.values,
        provider: 'twelvedata'
      };
    } catch (error) {
      console.error('Twelve Data time series error:', error);
      throw new Error(`Twelve Data time series failed: ${error.message}`);
    }
  }

  // Intelligent data fetching with fallbacks
  async getBestQuote(symbol) {
    const providers = ['polygon', 'fmp', 'twelvedata', 'alphavantage'];

    for (const provider of providers) {
      try {
        switch (provider) {
          case 'polygon':
            if (this.polygonApiKey) return await this.getPolygonQuote(symbol);
            break;
          case 'fmp':
            if (this.fmpApiKey) return await this.getFMPQuote(symbol);
            break;
          case 'twelvedata':
            if (this.twelveDataApiKey) return await this.getTwelveDataQuote(symbol);
            break;
          case 'alphavantage':
            if (this.alphaVantageApiKey) return await this.getAlphaVantageQuote(symbol);
            break;
        }
      } catch (error) {
        console.warn(`${provider} failed, trying next provider:`, error.message);
        continue;
      }
    }

    throw new Error('All market data providers failed');
  }

  async getBestOptionsChain(symbol, expiration) {
    // Try premium providers first
    const providers = ['polygon', 'fmp'];

    for (const provider of providers) {
      try {
        switch (provider) {
          case 'polygon':
            if (this.polygonApiKey) return await this.getPolygonOptionsChain(symbol, expiration);
            break;
          case 'fmp':
            if (this.fmpApiKey) return await this.getFMPOptionsChain(symbol);
            break;
        }
      } catch (error) {
        console.warn(`${provider} options chain failed, trying next:`, error.message);
        continue;
      }
    }

    throw new Error('No options chain data available');
  }
}

export default MarketDataClient;
