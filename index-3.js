import { useState, useEffect } from 'react'
import Head from 'next/head'
import Layout from '../components/Layout/Layout'
import Calculator from '../components/Calculator/Calculator'
import OptionsChain from '../components/OptionsChain/OptionsChain'
import Charts from '../components/Charts/Charts'
import { toast } from 'react-hot-toast'

export default function Home() {
  const [currentStock, setCurrentStock] = useState({
    symbol: '',
    price: null,
    volatility: 0.25,
    riskFreeRate: 0.05
  })

  const [calculationResult, setCalculationResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  return (
    <>
      <Head>
        <title>Options Profit Calculator - Professional Trading Tool</title>
        <meta name="description" content="Calculate options profits, analyze strategies, and visualize P&L with real-time market data" />
      </Head>

      <Layout>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Options Profit Calculator
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Professional options trading analysis with real-time market data
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {currentStock.symbol && (
                    <div className="text-right">
                      <div className="font-semibold">{currentStock.symbol}</div>
                      <div>${currentStock.price?.toFixed(2) || 'N/A'}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left Panel - Calculator */}
              <div className="lg:col-span-2">
                <Calculator
                  currentStock={currentStock}
                  setCurrentStock={setCurrentStock}
                  onCalculationComplete={setCalculationResult}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              </div>

              {/* Right Panel - Options Chain */}
              <div className="lg:col-span-1">
                <OptionsChain 
                  symbol={currentStock.symbol}
                  onOptionSelect={(option) => {
                    toast.success('Option selected - configure your strategy');
                  }}
                />
              </div>
            </div>

            {/* Charts Section */}
            {calculationResult && (
              <div className="mt-8">
                <Charts 
                  data={calculationResult}
                  symbol={currentStock.symbol}
                  currentPrice={currentStock.price}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="bg-gray-800 text-white py-8 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Features</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>• Black-Scholes Pricing</li>
                    <li>• Real-time Market Data</li>
                    <li>• Multi-leg Strategies</li>
                    <li>• Greeks Analysis</li>
                    <li>• P&L Visualization</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Supported APIs</h3>
                  <ul className="space-y-2 text-gray-300">
                    <li>• Polygon (Premium)</li>
                    <li>• Financial Modeling Prep</li>
                    <li>• Alpha Vantage (Free)</li>
                    <li>• Twelve Data (Free)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Risk Disclaimer</h3>
                  <p className="text-gray-300 text-sm">
                    This calculator is for educational purposes only. 
                    Options trading involves significant risk and may result 
                    in total loss. Please consult with a financial advisor 
                    before making investment decisions.
                  </p>
                </div>
              </div>
              <div className="border-t border-gray-700 mt-8 pt-4 text-center text-gray-400">
                <p>&copy; 2024 Options Profit Calculator. Built with Next.js.</p>
              </div>
            </div>
          </footer>
        </div>
      </Layout>
    </>
  )
}
