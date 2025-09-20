import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout/Layout';
import Calculator from '../components/Calculator/Calculator';
import Charts from '../components/Charts/Charts';
import OptionsChain from '../components/OptionsChain/OptionsChain';

export default function Home() {
  // State management for the entire application
  const [symbol, setSymbol] = useState('AAPL');
  const [marketData, setMarketData] = useState(null);
  const [calculationResults, setCalculationResults] = useState(null);
  const [optionsChainData, setOptionsChainData] = useState(null);
  const [loading, setLoading] = useState({
    marketData: false,
    calculation: false,
    optionsChain: false
  });
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('calculator');

  // Calculator state
  const [calculatorInputs, setCalculatorInputs] = useState({
    strategy: 'long_call',
    stockPrice: 0,
    strikePrice: 0,
    premium: 0,
    daysToExpiration: 30,
    volatility: 0.25,
    riskFreeRate: 0.05,
    quantity: 1
  });

  // Fetch market data when symbol changes
  useEffect(() => {
    if (symbol) {
      fetchMarketData(symbol);
      fetchOptionsChain(symbol);
    }
  }, [symbol]);

  // Update calculator inputs when market data changes
  useEffect(() => {
    if (marketData) {
      setCalculatorInputs(prev => ({
        ...prev,
        stockPrice: marketData.price || 0
      }));
    }
  }, [marketData]);

  // Fetch real-time market data
  const fetchMarketData = async (ticker) => {
    setLoading(prev => ({ ...prev, marketData: true }));
    setError(null);

    try {
      const response = await fetch(`/api/market-data?symbol=${ticker}`);
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }
      const data = await response.json();
      setMarketData(data);
    } catch (err) {
      setError('Failed to fetch market data. Please try again.');
      console.error('Market data error:', err);
    } finally {
      setLoading(prev => ({ ...prev, marketData: false }));
    }
  };

  // Fetch options chain data
  const fetchOptionsChain = async (ticker) => {
    setLoading(prev => ({ ...prev, optionsChain: true }));

    try {
      const response = await fetch(`/api/options-chain/${ticker}`);
      if (!response.ok) {
        throw new Error('Failed to fetch options chain');
      }
      const data = await response.json();
      setOptionsChainData(data);
    } catch (err) {
      console.error('Options chain error:', err);
    } finally {
      setLoading(prev => ({ ...prev, optionsChain: false }));
    }
  };

  // Perform options calculations
  const calculateOptions = async (inputs) => {
    setLoading(prev => ({ ...prev, calculation: true }));

    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputs)
      });

      if (!response.ok) {
        throw new Error('Calculation failed');
      }

      const results = await response.json();
      setCalculationResults(results);
    } catch (err) {
      setError('Calculation failed. Please check your inputs.');
      console.error('Calculation error:', err);
    } finally {
      setLoading(prev => ({ ...prev, calculation: false }));
    }
  };

  // Handle calculator input changes
  const handleCalculatorChange = (newInputs) => {
    setCalculatorInputs(newInputs);
    calculateOptions(newInputs);
  };

  // Handle symbol change
  const handleSymbolChange = (newSymbol) => {
    const upperSymbol = newSymbol.toUpperCase();
    setSymbol(upperSymbol);
    setError(null);
  };

  // Export functionality
  const exportResults = () => {
    if (!calculationResults) return;

    const exportData = {
      symbol,
      inputs: calculatorInputs,
      results: calculationResults,
      marketData,
      timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `options_analysis_${symbol}_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <>
      <Head>
        <title>Options Profit Calculator - Professional Trading Tools</title>
        <meta name="description" content="Professional options profit calculator with real-time market data, Black-Scholes pricing, and comprehensive strategy analysis." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* Header Section */}
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Options Profit Calculator
                  </h1>
                  <p className="mt-2 text-sm text-gray-600">
                    Professional-grade options analysis with real-time market data
                  </p>
                </div>

                {/* Symbol Input */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="symbol" className="text-sm font-medium text-gray-700">
                      Symbol:
                    </label>
                    <input
                      id="symbol"
                      type="text"
                      value={symbol}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm uppercase"
                      placeholder="AAPL"
                    />
                  </div>

                  {/* Market Data Display */}
                  {marketData && (
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center">
                        <span className="text-gray-600">Price:</span>
                        <span className="ml-1 font-semibold text-gray-900">
                          ${marketData.price?.toFixed(2)}
                        </span>
                        <span className={`ml-2 ${
                          marketData.change >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {marketData.change >= 0 ? '+' : ''}
                          {marketData.change?.toFixed(2)} ({marketData.changePercent?.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {loading.marketData && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                  <div className="ml-auto pl-3">
                    <button
                      onClick={() => setError(null)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* Tab Navigation */}
            <div className="mb-8">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'calculator', name: 'Calculator', icon: '📊' },
                    { id: 'charts', name: 'Charts & Analysis', icon: '📈' },
                    { id: 'options-chain', name: 'Options Chain', icon: '🔗' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-8">

              {/* Calculator Tab */}
              {activeTab === 'calculator' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <Calculator
                      inputs={calculatorInputs}
                      onChange={handleCalculatorChange}
                      marketData={marketData}
                      loading={loading.calculation}
                    />
                  </div>

                  <div className="space-y-6">
                    {/* Results Summary */}
                    {calculationResults && (
                      <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Analysis Results
                        </h3>

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Option Price:</span>
                            <span className="font-medium">${calculationResults.optionPrice?.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Max Profit:</span>
                            <span className="font-medium text-green-600">
                              {calculationResults.maxProfit === 'Unlimited' ? 
                                'Unlimited' : 
                                `$${calculationResults.maxProfit?.toFixed(2)}`}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Max Loss:</span>
                            <span className="font-medium text-red-600">
                              ${calculationResults.maxLoss?.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Breakeven:</span>
                            <span className="font-medium">
                              ${calculationResults.breakeven?.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-gray-600">Probability of Profit:</span>
                            <span className="font-medium">
                              {calculationResults.probabilityOfProfit?.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Greeks */}
                        {calculationResults.greeks && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Greeks</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Delta:</span>
                                <span className="font-medium">{calculationResults.greeks.delta?.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Gamma:</span>
                                <span className="font-medium">{calculationResults.greeks.gamma?.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Theta:</span>
                                <span className="font-medium">{calculationResults.greeks.theta?.toFixed(4)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Vega:</span>
                                <span className="font-medium">{calculationResults.greeks.vega?.toFixed(4)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Export Button */}
                        <button
                          onClick={exportResults}
                          className="mt-6 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          Export Analysis
                        </button>
                      </div>
                    )}

                    {loading.calculation && (
                      <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-3 text-gray-600">Calculating...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Charts Tab */}
              {activeTab === 'charts' && (
                <div>
                  <Charts
                    calculationResults={calculationResults}
                    inputs={calculatorInputs}
                    marketData={marketData}
                  />
                </div>
              )}

              {/* Options Chain Tab */}
              {activeTab === 'options-chain' && (
                <div>
                  <OptionsChain
                    symbol={symbol}
                    data={optionsChainData}
                    loading={loading.optionsChain}
                    onOptionSelect={(option) => {
                      setCalculatorInputs(prev => ({
                        ...prev,
                        strikePrice: option.strike,
                        premium: option.lastPrice || option.mid || 0
                      }));
                      setActiveTab('calculator');
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
}
