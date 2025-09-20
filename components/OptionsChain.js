import { useState, useEffect } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { List, Calendar, TrendingUp, Search } from 'lucide-react'

export default function OptionsChain({ symbol, onOptionSelect }) {
  const [optionsData, setOptionsData] = useState(null)
  const [selectedExpiration, setSelectedExpiration] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchExpiry, setSearchExpiry] = useState('')

  // Auto-fetch options chain when symbol changes
  useEffect(() => {
    if (symbol && symbol.length >= 1) {
      // Set default expiration to next Friday (common options expiry)
      const nextFriday = getNextFriday()
      setSelectedExpiration(nextFriday)
      setSearchExpiry(nextFriday)
    }
  }, [symbol])

  // Fetch when both symbol and expiration are set
  useEffect(() => {
    if (symbol && selectedExpiration && selectedExpiration.length >= 10) {
      fetchOptionsChain()
    }
  }, [symbol, selectedExpiration])

  const getNextFriday = () => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
    const nextFriday = new Date(today.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000)
    return nextFriday.toISOString().split('T')[0]
  }

  const fetchOptionsChain = async () => {
    if (!symbol || !selectedExpiration) return

    try {
      setIsLoading(true)
      const response = await axios.get(`/api/market-data?symbol=${symbol}&dataType=options-chain&expiration=${selectedExpiration}`)

      if (response.data.success) {
        setOptionsData(response.data.data)
        toast.success(`Loaded options chain for ${symbol}`)
      } else {
        throw new Error(response.data.error || 'Failed to load options chain')
      }
    } catch (error) {
      toast.error(`Options chain unavailable: ${error.response?.data?.details || error.message}`)
      setOptionsData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExpirationSearch = () => {
    setSelectedExpiration(searchExpiry)
  }

  const handleOptionClick = (option, type) => {
    if (onOptionSelect) {
      onOptionSelect({
        ...option,
        type: type,
        symbol: symbol,
        expiration: selectedExpiration
      })
    }
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return `$${parseFloat(value).toFixed(2)}`
  }

  const formatPercent = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return `${(parseFloat(value) * 100).toFixed(1)}%`
  }

  if (!symbol) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <List className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Options Chain</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <List className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Enter a stock symbol to view options chain</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <List className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Options Chain</h2>
      </div>

      {/* Expiration Date Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Expiration Date
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={searchExpiry}
            onChange={(e) => setSearchExpiry(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleExpirationSearch}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading options chain...</p>
        </div>
      )}

      {/* Options Chain Data */}
      {!isLoading && optionsData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{symbol} - {selectedExpiration}</span>
            <span>{optionsData.totalContracts} contracts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-gray-600">Calls</th>
                  <th className="px-2 py-2 text-center text-gray-900 font-semibold">Strike</th>
                  <th className="px-2 py-2 text-right text-gray-600">Puts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {optionsData.chain.map((strikeData, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {/* Calls Column */}
                    <td className="px-2 py-3">
                      {strikeData.calls && strikeData.calls.length > 0 ? (
                        <div className="space-y-1">
                          {strikeData.calls.map((call, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleOptionClick(call, 'call')}
                              className="w-full text-left p-2 rounded hover:bg-green-50 border border-green-200"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-green-700">
                                  {formatCurrency(call.lastPrice || call.bid)}
                                </span>
                                <span className="text-green-600 text-xs">
                                  {call.volume || 0}
                                </span>
                              </div>
                              {call.impliedVolatility && (
                                <div className="text-xs text-gray-500">
                                  IV: {formatPercent(call.impliedVolatility)}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center">-</div>
                      )}
                    </td>

                    {/* Strike Column */}
                    <td className="px-2 py-3 text-center font-medium text-gray-900">
                      ${strikeData.strike}
                    </td>

                    {/* Puts Column */}
                    <td className="px-2 py-3">
                      {strikeData.puts && strikeData.puts.length > 0 ? (
                        <div className="space-y-1">
                          {strikeData.puts.map((put, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleOptionClick(put, 'put')}
                              className="w-full text-right p-2 rounded hover:bg-red-50 border border-red-200"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-red-600 text-xs">
                                  {put.volume || 0}
                                </span>
                                <span className="font-medium text-red-700">
                                  {formatCurrency(put.lastPrice || put.bid)}
                                </span>
                              </div>
                              {put.impliedVolatility && (
                                <div className="text-xs text-gray-500">
                                  IV: {formatPercent(put.impliedVolatility)}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center">-</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>📈 Calls (Green) - Right to buy at strike</span>
              <span>📉 Puts (Red) - Right to sell at strike</span>
            </div>
            <div>Click any option to add to your strategy</div>
          </div>
        </div>
      )}

      {/* Fallback Message */}
      {!isLoading && !optionsData && symbol && (
        <div className="text-center py-8">
          <div className="text-gray-500">
            <List className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="mb-2">Options chain not available for {symbol}</p>
            <p className="text-sm">Enter option details manually in the calculator</p>
          </div>
        </div>
      )}
    </div>
  )
}
