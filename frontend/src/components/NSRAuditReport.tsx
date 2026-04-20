'use client';

import { useRef } from 'react';
import type { NSRAuditReport as AuditReportType } from '@/lib/api';

interface Props {
  report: AuditReportType;
  onClose: () => void;
}

function fmt(n: number, d = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}

function fmtCur(n: number, d = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n);
}

export default function NSRAuditReport({ report, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const s = report.results_summary;

  const cascadeItems = [
    { label: 'NSR Mineral Resources', value: s.nsr_mineral_resources },
    { label: 'Dilution Loss', value: -s.dilution_loss },
    { label: 'NSR Mine', value: s.nsr_mine },
    { label: 'Recovery Loss', value: -s.recovery_loss },
    { label: 'NSR Processing', value: s.nsr_processing },
    { label: 'Selling Costs', value: -s.selling_costs_per_tonne },
    { label: 'NSR Final', value: s.nsr_per_tonne },
  ];
  const maxCascade = Math.max(...cascadeItems.map((c) => Math.abs(c.value)), 1);

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body > *:not(.audit-print-root) {
            display: none !important;
          }
          .audit-print-root {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .audit-no-print {
            display: none !important;
          }
          .audit-step-card {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="audit-print-root fixed inset-0 z-50 overflow-y-auto bg-gray-100 dark:bg-gray-900">
        {/* Sticky toolbar */}
        <div className="audit-no-print sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              NSR Calculation Audit Report
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / PDF
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Report body */}
        <div ref={printRef} className="max-w-5xl mx-auto px-6 py-8 space-y-8">

          {/* ── Section 1: Header ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              NSR Calculation Audit Report
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Mine</span>
                <p className="font-medium text-gray-900 dark:text-white">{report.mine}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Area</span>
                <p className="font-medium text-gray-900 dark:text-white">{report.area}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Generated</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(report.generated_at).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Final NSR</span>
                <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                  {fmtCur(s.nsr_per_tonne)}/t
                </p>
              </div>
            </div>
          </section>

          {/* ── Section 2: Input Parameters ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Input Parameters
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Parameter</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Value</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Unit</th>
                    <th className="text-center py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Source</th>
                    <th className="text-right py-2 pl-4 font-medium text-gray-500 dark:text-gray-400">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {report.inputs.map((inp, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 dark:border-gray-700/50 ${
                        inp.source === 'default' ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                      }`}
                    >
                      <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{inp.parameter}</td>
                      <td className="py-2 px-4 text-right font-mono text-gray-900 dark:text-gray-100">
                        {typeof inp.value === 'number' ? fmt(inp.value, 4) : inp.value}
                      </td>
                      <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{inp.unit}</td>
                      <td className="py-2 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            inp.source === 'user'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {inp.source}
                        </span>
                      </td>
                      <td className="py-2 pl-4 text-right font-mono text-gray-400 dark:text-gray-500">
                        {inp.default_value != null
                          ? typeof inp.default_value === 'number'
                            ? fmt(inp.default_value, 4)
                            : inp.default_value
                          : '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Section 3: Constants & Recovery Parameters ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Constants &amp; Recovery Parameters
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Physical Constants</h3>
                <dl className="space-y-1 text-sm">
                  {Object.entries(report.constants).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <dt className="font-mono text-gray-700 dark:text-gray-300">{k}</dt>
                      <dd className="font-mono text-gray-900 dark:text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Recovery Parameters
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                    ({report.recovery_params.source})
                  </span>
                </h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-700 dark:text-gray-300">Area</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">{report.recovery_params.area}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-mono text-gray-700 dark:text-gray-300">a (slope)</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">{report.recovery_params.a}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-mono text-gray-700 dark:text-gray-300">b (intercept)</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">{report.recovery_params.b}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-mono text-gray-700 dark:text-gray-300">fixed</dt>
                    <dd className="font-mono text-gray-900 dark:text-white">
                      {report.recovery_params.fixed != null ? report.recovery_params.fixed : '\u2014'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {/* ── Section 4: Step-by-step Calculation ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Step-by-Step Calculation
            </h2>
            <div className="space-y-4">
              {report.steps.map((step) => (
                <div
                  key={step.step}
                  className="audit-step-card border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold mr-2">
                        {step.step}
                      </span>
                      {step.name}
                    </h3>
                    <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
                      {fmt(step.result, step.unit === 'decimal' ? 6 : 2)} <span className="text-sm font-normal text-gray-500">{step.unit}</span>
                    </span>
                  </div>

                  <div className="mt-2 space-y-2">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Formula</span>
                      <pre className="mt-0.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded px-3 py-2 whitespace-pre-wrap">
                        {step.formula}
                      </pre>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">Substitution</span>
                      <pre className="mt-0.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded px-3 py-2 whitespace-pre-wrap">
                        {step.substitution}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 5: Cross-checks ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cross-checks
            </h2>
            <div className="space-y-3">
              {report.cross_checks.map((cc, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    cc.passed
                      ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                      : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        cc.passed
                          ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                          : 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                      }`}
                    >
                      {cc.passed ? '\u2713' : '\u2717'}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{cc.label}</span>
                  </div>
                  <div className="text-right text-xs font-mono text-gray-500 dark:text-gray-400">
                    <span>exp {fmt(cc.expected, 4)}</span>
                    <span className="mx-2">|</span>
                    <span>act {fmt(cc.actual, 4)}</span>
                    <span className="mx-2">|</span>
                    <span>\u0394 {fmt(cc.difference, 6)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 6: Results Summary ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Results Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: 'NSR per Tonne', key: 'nsr_per_tonne', unit: '$/t ore' },
                { label: 'NSR Cu', key: 'nsr_cu', unit: '$/t ore' },
                { label: 'NSR Au', key: 'nsr_au', unit: '$/t ore' },
                { label: 'NSR Ag', key: 'nsr_ag', unit: '$/t ore' },
                { label: 'NSR Min. Resources', key: 'nsr_mineral_resources', unit: '$/t ore' },
                { label: 'NSR Mine', key: 'nsr_mine', unit: '$/t ore' },
                { label: 'NSR Processing', key: 'nsr_processing', unit: '$/t ore' },
                { label: 'Conc Price Total', key: 'conc_price_total', unit: '$/t conc' },
                { label: 'Conc Ratio', key: 'conc_ratio', unit: 't conc/t ore' },
                { label: 'Cu Recovery', key: 'cu_recovery', unit: '' },
                { label: 'Revenue Total', key: 'revenue_total', unit: '$' },
                { label: 'Dilution Loss', key: 'dilution_loss', unit: '$/t ore' },
              ].map(({ label, key, unit }) => (
                <div key={key} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  <p className="font-mono font-medium text-gray-900 dark:text-white">
                    {fmt(s[key] ?? 0, key === 'conc_ratio' ? 6 : key === 'cu_recovery' ? 4 : 2)}
                  </p>
                  {unit && <span className="text-xs text-gray-400 dark:text-gray-500">{unit}</span>}
                </div>
              ))}
            </div>
          </section>

          {/* ── Section 7: Cascade Waterfall ── */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              NSR Cascade Waterfall
            </h2>
            <div className="space-y-2">
              {cascadeItems.map((item, i) => {
                const isLoss = item.value < 0;
                const isTotal = item.label === 'NSR Final';
                const pct = (Math.abs(item.value) / maxCascade) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-40 text-sm text-right text-gray-700 dark:text-gray-300 flex-shrink-0">
                      {item.label}
                    </span>
                    <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md transition-all ${
                          isTotal
                            ? 'bg-blue-500 dark:bg-blue-600'
                            : isLoss
                              ? 'bg-red-400 dark:bg-red-600'
                              : 'bg-green-400 dark:bg-green-600'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`w-24 text-right text-sm font-mono flex-shrink-0 ${
                        isLoss
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {isLoss ? '' : ''}{fmtCur(item.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
