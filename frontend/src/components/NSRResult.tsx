'use client';

import { NSRResult as NSRResultType } from '@/lib/api';

interface NSRResultProps {
  result: NSRResultType;
}

function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export default function NSRResult({ result }: NSRResultProps) {
  const metalBreakdown = [
    { metal: 'Cu', nsr: result.nsr_cu, concPrice: result.conc_price_cu, color: 'bg-orange-500' },
    { metal: 'Au', nsr: result.nsr_au, concPrice: result.conc_price_au, color: 'bg-yellow-500' },
    { metal: 'Ag', nsr: result.nsr_ag, concPrice: result.conc_price_ag, color: 'bg-gray-400' },
  ];

  const totalNSR = result.nsr_cu + result.nsr_au + result.nsr_ag;

  return (
    <div className="space-y-6">
      {/* Main NSR Result */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="text-center">
          <p className="text-blue-100 text-sm uppercase tracking-wide mb-1">
            NSR por Tonelada de Minério
          </p>
          <p className="text-5xl font-bold">
            {formatCurrency(result.nsr_per_tonne)}
            <span className="text-xl font-normal text-blue-200">/t ore</span>
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-blue-200 text-sm">Receita Total</p>
            <p className="text-2xl font-semibold">{formatCurrency(result.revenue_total, 0)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-sm">Tonelagem</p>
            <p className="text-2xl font-semibold">{formatNumber(result.ore_tonnage, 0)} t</p>
          </div>
        </div>
      </div>

      {/* Metal Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Contribuição por Metal ($/t ore)
        </h3>
        <div className="space-y-4">
          {metalBreakdown.map((item) => {
            const percentage = totalNSR > 0 ? (item.nsr / totalNSR) * 100 : 0;
            return (
              <div key={item.metal}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{item.metal}</span>
                  <span className="text-gray-900 font-semibold">
                    {formatCurrency(item.nsr)} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`${item.color} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Concentrate Prices */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Preço do Concentrado ($/t conc)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600">Cu</p>
            <p className="text-lg font-semibold text-orange-700">
              {formatCurrency(result.conc_price_cu)}
            </p>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600">Au</p>
            <p className="text-lg font-semibold text-yellow-700">
              {formatCurrency(result.conc_price_au)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Ag</p>
            <p className="text-lg font-semibold text-gray-700">
              {formatCurrency(result.conc_price_ag)}
            </p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-lg font-semibold text-blue-700">
              {formatCurrency(result.conc_price_total)}
            </p>
          </div>
        </div>
      </div>

      {/* Technical Parameters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Parâmetros Técnicos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600">Recuperação Cu</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatPercent(result.cu_recovery)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Recuperação Au</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatPercent(result.au_recovery)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Recuperação Ag</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatPercent(result.ag_recovery)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Razão de Concentrado</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatNumber(result.conc_ratio, 4)}
            </p>
          </div>
        </div>
      </div>

      {/* NSR Cascade / Waterfall */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Cascata de NSR ($/t ore)
        </h3>
        
        {/* Waterfall visualization */}
        <div className="space-y-3">
          {/* Mineral Resources */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
            <div>
              <p className="text-sm text-green-800 font-medium">Mineral Resources</p>
              <p className="text-xs text-green-600">Valor teórico máximo</p>
            </div>
            <p className="text-xl font-bold text-green-700">
              {formatCurrency(result.nsr_mineral_resources)}
            </p>
          </div>

          {/* Arrow and Loss - Dilution */}
          <div className="flex items-center pl-6">
            <div className="flex-1 border-l-2 border-dashed border-yellow-400 pl-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-yellow-700">
                  − Diluição & Ore Recovery
                </span>
                <span className="text-sm font-medium text-yellow-700">
                  -{formatCurrency(result.dilution_loss)}
                </span>
              </div>
            </div>
          </div>

          {/* Mine */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <div>
              <p className="text-sm text-blue-800 font-medium">NSR Mine</p>
              <p className="text-xs text-blue-600">Após fatores de mina</p>
            </div>
            <p className="text-xl font-bold text-blue-700">
              {formatCurrency(result.nsr_mine)}
            </p>
          </div>

          {/* Arrow and Loss - Recovery */}
          <div className="flex items-center pl-6">
            <div className="flex-1 border-l-2 border-dashed border-orange-400 pl-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-orange-700">
                  − Recuperação Metalúrgica
                </span>
                <span className="text-sm font-medium text-orange-700">
                  -{formatCurrency(result.recovery_loss)}
                </span>
              </div>
            </div>
          </div>

          {/* Processing */}
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
            <div>
              <p className="text-sm text-purple-800 font-medium">NSR Processing</p>
              <p className="text-xs text-purple-600">Após processamento</p>
            </div>
            <p className="text-xl font-bold text-purple-700">
              {formatCurrency(result.nsr_processing)}
            </p>
          </div>

          {/* Arrow and Loss - Selling Costs */}
          <div className="flex items-center pl-6">
            <div className="flex-1 border-l-2 border-dashed border-red-400 pl-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-red-700">
                  − Selling Costs (TC, RC, Freight)
                </span>
                <span className="text-sm font-medium text-red-700">
                  -{formatCurrency(result.nsr_processing - result.nsr_per_tonne)}
                </span>
              </div>
            </div>
          </div>

          {/* Final NSR */}
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm text-gray-200 font-medium">NSR Final</p>
              <p className="text-xs text-gray-400">Valor líquido</p>
            </div>
            <p className="text-xl font-bold text-white">
              {formatCurrency(result.nsr_per_tonne)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
