import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { TrendingUp, Calculator as CalcIcon, Target, DollarSign } from 'lucide-react'

const STRATEGY_TYPES = {
  single_long_call: 'Long Call',
  single_long_put: 'Long Put', 
  single_short_call: 'Short Call',
  single_short_put: 'Short Put',
  bull_call_spread: 'Bull Call Spread',
  bear_call_spread: 'Bear Call Spread',
  bull_put_spread: 'Bull Put Spread',
  bear_put_spread: 'Bear Put Spread',
  long_straddle: 'Long Straddle',
  short_straddle: 'Short Straddle',
  long_strangle: 'Long Strangle',
  short_strangle: 'Short Strangle',
  iron_condor: 'Iron Condor',
  iron_butterfly: 'Iron Butterfly',
  covered_call: 'Covered Call',
  protective_put: 'Protective Put'
}

export default function Calculator({ 
  currentStock, 
  setCurrentStock, 
  onCalculationComplete,
  isLoading,
  setIsLoading
}) {
  const [strategy, setStrategy] = useState('single_long_call')
  const [legs, setLegs] = useState([{
    id: 1,
    type: 'long',
    optionType: 'call',
    strike: '',
    premium: '',
    quantity: 1,
    expiration: ''
  }])

  // Auto-fetch stock data when symbol changes
  useEffect(() => {
    if (currentStock.symbol && currentStock.symbol.length >= 1) {
      fetchStockData(currentStock.symbol)
    }
  }, [currentStock.symbol])

  const fetchStockData = async (symbol) => {
    try {
      setIsLoading(true)

      // Fetch quote
      const quoteResponse = await axios.get(`/api/market-data?symbol=${symbol}&dataType=quote`)

      if (quoteResponse.data.success) {
        setCurrentStock(prev => ({
          ...prev,
          price: quoteResponse.data.data.price
        }))
        toast.success(`Loaded ${symbol} at $${quoteResponse.data.data.price}`)
      }

      // Fetch volatility
      try {
        const volResponse = await axios.get(`/api/market-data?symbol=${symbol}&dataType=volatility`)
        if (volResponse.data.success) {
          setCurrentStock(prev => ({
            ...prev,
            volatility: volResponse.data.data.historicalVolatility
          }))
        }
      } catch (error) {
        console.log('Volatility fetch failed, using default')
      }

    } catch (error) {
      toast.error(`Failed to fetch ${symbol} data. Please enter manually.`)
      console.error('Stock data fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateStrategy = (newStrategy) => {
    setStrategy(newStrategy)

    // Auto-configure legs based on strategy
    switch (newStrategy) {
      case 'single_long_call':
        setLegs([{ id: 1, type: 'long', optionType: 'call', strike: '', premium: '', quantity: 1, expiration: '' }])
        break
      case 'single_long_put':
        setLegs([{ id: 1, type: 'long', optionType: 'put', strike: '', premium: '', quantity: 1, expiration: '' }])
        break
      case 'bull_call_spread':
        setLegs([
          { id: 1, type: 'long', optionType: 'call', strike: '', premium: '', quantity: 1, expiration: '' },
          { id: 2, type: 'short', optionType: 'call', strike: '', premium: '', quantity: 1, expiration: '' }
        ])
        break
      case 'long_straddle':
        setLegs([
          { id: 1, type: 'long', optionType: 'call', strike: '', premium: '', quantity: 1, expiration: '' },
          { id: 2, type: 'long', optionType: 'put', strike: '', premium: '', quantity: 1, expiration: '' }
        ])
        break
      case 'iron_condor':
        setLegs([
          { id: 1, type: 'short', optionType: 'put', strike: '', premium: '', quantity: 1, expiration: '' },
          { id: 2, type: 'long', optionType: 'put', strike: '', premium: '', quantity: 1, expiration: '' },
          { id: 3, type: 'short', optionType: 'call', strike: '', premium: '', quantity: 1, expiration: '' },
          { id: 4, type: 'long', optionType: 'call', strike: '', premium: '', quantity: 1, expiration: '' }
        ])
        break
      default:
        break
    }
  }

  const addLeg = () => {
    const newId = Math.max(...legs.map(l => l.id)) + 1
    setLegs([...legs, {
      id: newId,
      type: 'long',
      optionType: 'call',
      strike: '',
      premium: '',
      quantity: 1,
      expiration: ''
    }])
  }

  const removeLeg = (id) => {
    if (legs.length > 1) {
      setLegs(legs.filter(leg => leg.id !== id))
    }
  }

  const updateLeg = (id, field, value) => {
    setLegs(legs.map(leg => 
      leg.id === id ? { ...leg, [field]: value } : leg
    ))
  }

  const calculateStrategy = async () => {
    try {
      setIsLoading(true)

      // Validate inputs
      if (!currentStock.symbol || !currentStock.price) {
        toast.error('Please enter stock symbol and price')
        return
      }

      const incompleteLegs = legs.filter(leg => !leg.strike || !leg.premium || !leg.expiration)
      if (incompleteLegs.length > 0) {
        toast.error('Please complete all option leg details')
        return
      }

      const calculationData = {
        calculationType: 'strategy',
        stockPrice: currentStock.price,
        riskFreeRate: currentStock.riskFreeRate,
        impliedVolatility: currentStock.volatility,
        legs: legs.map(leg => ({
          type: leg.type,
          strike: parseFloat(leg.strike),
          premium: parseFloat(leg.premium),
          quantity: parseInt(leg.quantity),
          optionType: leg.optionType,
          expiration: leg.expiration
        }))
      }

      const response = await axios.post('/api/calculate', calculationData)

      if (response.data.success) {
        onCalculationComplete(response.data.result)
        toast.success('Strategy calculated successfully!')
      } else {
        toast.error('Calculation failed')
      }

    } catch (error) {
      toast.error('Calculation error: ' + (error.response?.data?.error || error.message))
      console.error('Calculation error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <CalcIcon className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Options Strategy Calculator</h2>
      </div>

      {/* Stock Input Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Stock Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Symbol
            </label>
            <input
              type="text"
              placeholder="AAPL"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentStock.symbol}
              onChange={(e) => setCurrentStock(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Price ($)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="150.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentStock.price || ''}
              onChange={(e) => setCurrentStock(prev => ({ ...prev, price: parseFloat(e.target.value) || null }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Implied Volatility (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="500"
              placeholder="25"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={(currentStock.volatility * 100).toFixed(2)}
              onChange={(e) => setCurrentStock(prev => ({ ...prev, volatility: parseFloat(e.target.value) / 100 || 0.25 }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk-free Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              placeholder="5"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={(currentStock.riskFreeRate * 100).toFixed(2)}
              onChange={(e) => setCurrentStock(prev => ({ ...prev, riskFreeRate: parseFloat(e.target.value) / 100 || 0.05 }))}
            />
          </div>
        </div>
      </div>

      {/* Strategy Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Strategy Type
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={strategy}
          onChange={(e) => updateStrategy(e.target.value)}
        >
          {Object.entries(STRATEGY_TYPES).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Option Legs */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Option Legs
          </h3>
          <button
            onClick={addLeg}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Add Leg
          </button>
        </div>

        <div className="space-y-4">
          {legs.map((leg, index) => (
            <div key={leg.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium text-gray-900">Leg {index + 1}</span>
                {legs.length > 1 && (
                  <button
                    onClick={() => removeLeg(leg.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={leg.type}
                  onChange={(e) => updateLeg(leg.id, 'type', e.target.value)}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>

                <select
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={leg.optionType}
                  onChange={(e) => updateLeg(leg.id, 'optionType', e.target.value)}
                >
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>

                <input
                  type="number"
                  placeholder="Strike"
                  step="0.01"
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={leg.strike}
                  onChange={(e) => updateLeg(leg.id, 'strike', e.target.value)}
                />

                <input
                  type="number"
                  placeholder="Premium"
                  step="0.01"
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={leg.premium}
                  onChange={(e) => updateLeg(leg.id, 'premium', e.target.value)}
                />

                <input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={leg.quantity}
                  onChange={(e) => updateLeg(leg.id, 'quantity', e.target.value)}
                />

                <input
                  type="date"
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                  value={leg.expiration}
                  onChange={(e) => updateLeg(leg.id, 'expiration', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calculate Button */}
      <button
        onClick={calculateStrategy}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <DollarSign className="w-5 h-5" />
        {isLoading ? 'Calculating...' : 'Calculate Strategy'}
      </button>
    </div>
  )
}
