import { useState, useEffect } from 'react'

const STRATEGY_TEMPLATES = {
  'long_call': {
    name: 'Long Call',
    description: 'Bullish strategy with unlimited upside potential',
    legs: [{
      type: 'call',
      position: 'long',
      quantity: 1
    }]
  },
  'long_put': {
    name: 'Long Put',
    description: 'Bearish strategy with high profit potential',
    legs: [{
      type: 'put',
      position: 'long',
      quantity: 1
    }]
  },
  'bull_call_spread': {
    name: 'Bull Call Spread',
    description: 'Moderately bullish with limited risk and reward',
    legs: [
      { type: 'call', position: 'long', quantity: 1 },
      { type: 'call', position: 'short', quantity: 1 }
    ]
  },
  'bear_put_spread': {
    name: 'Bear Put Spread',
    description: 'Moderately bearish with limited risk and reward',
    legs: [
      { type: 'put', position: 'long', quantity: 1 },
      { type: 'put', position: 'short', quantity: 1 }
    ]
  },
  'straddle': {
    name: 'Long Straddle',
    description: 'Volatility play expecting big price movement',
    legs: [
      { type: 'call', position: 'long', quantity: 1 },
      { type: 'put', position: 'long', quantity: 1 }
    ]
  },
  'strangle': {
    name: 'Long Strangle',
    description: 'Lower cost volatility play than straddle',
    legs: [
      { type: 'call', position: 'long', quantity: 1 },
      { type: 'put', position: 'long', quantity: 1 }
    ]
  },
  'iron_condor': {
    name: 'Iron Condor',
    description: 'Range-bound strategy for neutral outlook',
    legs: [
      { type: 'put', position: 'long', quantity: 1 },
      { type: 'put', position: 'short', quantity: 1 },
      { type: 'call', position: 'short', quantity: 1 },
      { type: 'call', position: 'long', quantity: 1 }
    ]
  },
  'covered_call': {
    name: 'Covered Call',
    description: 'Generate income on existing stock position',
    legs: [
      { type: 'call', position: 'short', quantity: 1 }
    ]
  }
}

export default function Calculator({ marketData, onCalculation }) {
  const [selectedStrategy, setSelectedStrategy] = useState('long_call')
  const [strategy, setStrategy] = useState(STRATEGY_TEMPLATES['long_call'])
  const [loading, setLoading] = useState(false)

  // Initialize strategy legs with market data when available
  useEffect(() => {
    if (marketData && strategy) {
      const updatedStrategy = {
        ...strategy,
        legs: strategy.legs.map((leg, index) => ({
          ...leg,
          strike: marketData.currentPrice + (index * 5), // Default strikes around current price
          premium: 2.50, // Default premium
          expiration: getDefaultExpiration(),
          volatility: marketData.impliedVolatility
        }))
      }
      setStrategy(updatedStrategy)
    }
  }, [marketData, selectedStrategy])

  const handleStrategyChange = (strategyKey) => {
    setSelectedStrategy(strategyKey)
    const template = STRATEGY_TEMPLATES[strategyKey]
    setStrategy({
      ...template,
      legs: template.legs.map((leg, index) => ({
        ...leg,
        strike: marketData ? marketData.currentPrice + (index * 5) : 100,
        premium: 2.50,
        expiration: getDefaultExpiration(),
        volatility: marketData?.impliedVolatility || 0.25
      }))
    })
  }

  const updateLeg = (legIndex, field, value) => {
    const updatedStrategy = {
      ...strategy,
      legs: strategy.legs.map((leg, index) => 
        index === legIndex ? { ...leg, [field]: parseFloat(value) || value } : leg
      )
    }
    setStrategy(updatedStrategy)
  }

  const addLeg = () => {
    const newLeg = {
      type: 'call',
      position: 'long',
      quantity: 1,
      strike: marketData?.currentPrice || 100,
      premium: 2.50,
      expiration: getDefaultExpiration(),
      volatility: marketData?.impliedVolatility || 0.25
    }
    setStrategy({
      ...strategy,
      legs: [...strategy.legs, newLeg]
    })
  }

  const removeLeg = (legIndex) => {
    if (strategy.legs.length > 1) {
      setStrategy({
        ...strategy,
        legs: strategy.legs.filter((_, index) => index !== legIndex)
      })
    }
  }

  const calculateOptions = async () => {
    if (!marketData || !strategy.legs.length) return

    setLoading(true)
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy,
          marketData
        })
      })

      const result = await response.json()

      if (result.success) {
        onCalculation(result.data)
      } else {
        console.error('Calculation error:', result.error)
      }
    } catch (error) {
      console.error('Failed to calculate:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDefaultExpiration = () => {
    const date = new Date()
    date.setDate(date.getDate() + 30) // 30 days from now
    return date.toISOString().split('T')[0]
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-6 text-gray-900">Options Strategy Calculator</h2>

      {/* Strategy Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Strategy Template
        </label>
        <select
          value={selectedStrategy}
          onChange={(e) => handleStrategyChange(e.target.value)}
          className="input-field w-full"
        >
          {Object.entries(STRATEGY_TEMPLATES).map(([key, template]) => (
            <option key={key} value={key}>
              {template.name} - {template.description}
            </option>
          ))}
        </select>
      </div>

      {/* Strategy Legs */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Option Legs</h3>
          <button
            onClick={addLeg}
            className="btn-secondary text-sm"
          >
            Add Leg
          </button>
        </div>

        <div className="space-y-4">
          {strategy.legs.map((leg, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-medium text-gray-900">Leg {index + 1}</h4>
                {strategy.legs.length > 1 && (
                  <button
                    onClick={() => removeLeg(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Option Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={leg.type}
                    onChange={(e) => updateLeg(index, 'type', e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="call">Call</option>
                    <option value="put">Put</option>
                  </select>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <select
                    value={leg.position}
                    onChange={(e) => updateLeg(index, 'position', e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </div>

                {/* Strike Price */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Strike ($)
                  </label>
                  <input
                    type="number"
                    value={leg.strike || ''}
                    onChange={(e) => updateLeg(index, 'strike', e.target.value)}
                    className="input-field w-full text-sm"
                    step="0.50"
                  />
                </div>

                {/* Premium */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Premium ($)
                  </label>
                  <input
                    type="number"
                    value={leg.premium || ''}
                    onChange={(e) => updateLeg(index, 'premium', e.target.value)}
                    className="input-field w-full text-sm"
                    step="0.01"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={leg.quantity || 1}
                    onChange={(e) => updateLeg(index, 'quantity', e.target.value)}
                    className="input-field w-full text-sm"
                    min="1"
                  />
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Expiration
                  </label>
                  <input
                    type="date"
                    value={leg.expiration || ''}
                    onChange={(e) => updateLeg(index, 'expiration', e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>

                {/* Implied Volatility */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    IV (%)
                  </label>
                  <input
                    type="number"
                    value={leg.volatility ? (leg.volatility * 100).toFixed(1) : ''}
                    onChange={(e) => updateLeg(index, 'volatility', parseFloat(e.target.value) / 100)}
                    className="input-field w-full text-sm"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calculate Button */}
      <div className="text-center">
        <button
          onClick={calculateOptions}
          disabled={loading || !marketData}
          className="btn-primary px-8 py-3 text-lg"
        >
          {loading ? (
            <>
              <div className="loading-spinner mr-2"></div>
              Calculating...
            </>
          ) : (
            'Calculate P&L'
          )}
        </button>
      </div>

      {!marketData && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Enter a stock symbol above to enable calculations
        </div>
      )}
    </div>
  )
}
