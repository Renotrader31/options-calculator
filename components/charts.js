import { useState, useEffect } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { BarChart3, TrendingUp, Target, Download } from 'lucide-react'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default function Charts({ data, symbol, currentPrice }) {
  const [activeTab, setActiveTab] = useState('pl-chart')

  if (!data || !data.plData) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Analysis Charts</h2>
        </div>
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Calculate a strategy to view charts and analysis</p>
        </div>
      </div>
    )
  }

  const { summary, plData } = data

  // Prepare P&L chart data
  const plChartData = {
    labels: plData.atExpiration.map(point => `$${point.stockPrice.toFixed(0)}`),
    datasets: [
      {
        label: 'P&L at Expiration',
        data: plData.atExpiration.map(point => point.pl),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
      },
      {
        label: 'Current P&L',
        data: plData.current.map(point => point.pl),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: false,
        borderDash: [5, 5],
      }
    ],
  }

  const plChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${symbol} Options Strategy P&L Analysis`,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: $${context.parsed.y.toLocaleString()}`
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Stock Price'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Profit/Loss ($)'
        },
        grid: {
          color: function(context) {
            if (context.tick.value === 0) {
              return 'rgba(0, 0, 0, 0.3)'
            }
            return 'rgba(0, 0, 0, 0.1)'
          },
          lineWidth: function(context) {
            if (context.tick.value === 0) {
              return 2
            }
            return 1
          }
        }
      }
    },
    elements: {
      point: {
        radius: 0,
        hoverRadius: 6
      }
    }
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(1)}%`
  }

  const exportData = () => {
    const csvContent = [
      ['Stock Price', 'P&L at Expiration', 'Current P&L'],
      ...plData.atExpiration.map((point, index) => [
        point.stockPrice.toFixed(2),
        point.pl.toFixed(2),
        plData.current[index]?.pl.toFixed(2) || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${symbol}_options_analysis.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Strategy Analysis</h2>
        </div>
        <button
          onClick={exportData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('pl-chart')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'pl-chart'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          P&L Chart
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'summary'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Strategy Summary
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'metrics'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Key Metrics
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'pl-chart' && (
        <div className="space-y-6">
          <div className="h-96">
            <Line data={plChartData} options={plChartOptions} />
          </div>

          {/* Current Position Indicator */}
          {currentPrice && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Current Position</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Current Stock Price:</span>
                  <span className="ml-2 font-medium">{formatCurrency(currentPrice)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Current P&L:</span>
                  <span className={`ml-2 font-medium ${summary.currentPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.currentPL)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Max Profit</div>
              <div className={`text-lg font-semibold ${summary.maxProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summary.maxProfit !== null ? formatCurrency(summary.maxProfit) : 'Unlimited'}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Max Loss</div>
              <div className={`text-lg font-semibold ${summary.maxLoss <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {summary.maxLoss !== null ? formatCurrency(summary.maxLoss) : 'Unlimited'}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Net Premium</div>
              <div className={`text-lg font-semibold ${summary.totalPremium >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.totalPremium)}
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Risk/Reward</div>
              <div className="text-lg font-semibold text-gray-900">
                {summary.riskRewardRatio ? `${summary.riskRewardRatio.toFixed(2)}:1` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Breakeven Points</h3>
              {summary.breakevens && summary.breakevens.length > 0 ? (
                <div className="space-y-2">
                  {summary.breakevens.map((breakeven, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">Breakeven {index + 1}:</span>
                      <span className="font-medium">{formatCurrency(breakeven)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No breakeven points</p>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-3">Probability Analysis</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Probability of Profit:</span>
                  <span className="font-medium">
                    {summary.probabilityOfProfit ? formatPercent(summary.probabilityOfProfit) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current P&L:</span>
                  <span className={`font-medium ${summary.currentPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.currentPL)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="font-medium text-gray-900">Profit Scenarios</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Best Case:</span>
                  <span className="font-medium text-green-600">
                    {summary.maxProfit !== null ? formatCurrency(summary.maxProfit) : 'Unlimited'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current:</span>
                  <span className={`font-medium ${summary.currentPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.currentPL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Worst Case:</span>
                  <span className="font-medium text-red-600">
                    {summary.maxLoss !== null ? formatCurrency(summary.maxLoss) : 'Unlimited'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium text-gray-900">Position Details</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Legs:</span>
                  <span className="font-medium">{data.legs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Net Premium:</span>
                  <span className={`font-medium ${summary.totalPremium >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.totalPremium)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Capital Required:</span>
                  <span className="font-medium">
                    {formatCurrency(Math.abs(summary.totalPremium))}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <h3 className="font-medium text-gray-900">Risk Metrics</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Risk/Reward:</span>
                  <span className="font-medium">
                    {summary.riskRewardRatio ? `${summary.riskRewardRatio.toFixed(2)}:1` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Probability of Profit:</span>
                  <span className="font-medium">
                    {summary.probabilityOfProfit ? formatPercent(summary.probabilityOfProfit) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Breakevens:</span>
                  <span className="font-medium">
                    {summary.breakevens ? summary.breakevens.length : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Performance Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-900">Stock Price</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">P&L at Expiration</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">Current P&L</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {plData.atExpiration.filter((_, index) => index % 10 === 0).map((point, index) => {
                  const currentPoint = plData.current[index * 10]
                  const roi = summary.totalPremium !== 0 ? (point.pl / Math.abs(summary.totalPremium)) * 100 : 0

                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{formatCurrency(point.stockPrice)}</td>
                      <td className={`px-4 py-2 text-right ${point.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(point.pl)}
                      </td>
                      <td className={`px-4 py-2 text-right ${currentPoint?.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {currentPoint ? formatCurrency(currentPoint.pl) : 'N/A'}
                      </td>
                      <td className={`px-4 py-2 text-right ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(roi)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
