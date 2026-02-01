'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';

// Donut Chart Component
interface DonutChartData {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  className?: string;
}

export function DonutChart({ 
  data, 
  centerLabel, 
  centerValue, 
  height = 300,
  className = '' 
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DonutChartData }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ${item.value.toFixed(2)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => (
              <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Label */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ marginBottom: '36px' }}>
            {centerLabel && (
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {centerLabel}
              </p>
            )}
            {centerValue && (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {centerValue}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Waterfall Chart Component
interface WaterfallStep {
  name: string;
  value: number;
  type: 'start' | 'add' | 'subtract' | 'total';
  color?: string;
  description?: string;
}

interface WaterfallChartProps {
  steps: WaterfallStep[];
  className?: string;
}

export function WaterfallChart({ steps, className = '' }: WaterfallChartProps) {
  // Calculate cumulative values
  let cumulative = 0;
  const processedSteps = steps.map((step, index) => {
    let start = cumulative;
    let end = cumulative;

    if (step.type === 'start' || step.type === 'total') {
      start = 0;
      end = step.value;
    } else if (step.type === 'add') {
      end = cumulative + step.value;
    } else if (step.type === 'subtract') {
      end = cumulative - step.value;
    }

    if (step.type !== 'total') {
      cumulative = end;
    }

    return {
      ...step,
      start,
      end,
      index,
    };
  });

  const maxValue = Math.max(...processedSteps.map(s => Math.max(s.start, s.end)));
  const minValue = Math.min(...processedSteps.map(s => Math.min(s.start, s.end)), 0);
  const range = maxValue - minValue;

  const getBarStyle = (step: typeof processedSteps[0]) => {
    const top = ((maxValue - Math.max(step.start, step.end)) / range) * 100;
    const height = (Math.abs(step.end - step.start) / range) * 100;
    return { top: `${top}%`, height: `${height}%` };
  };

  const getColor = (step: typeof processedSteps[0]) => {
    if (step.color) return step.color;
    switch (step.type) {
      case 'start': return 'bg-green-500';
      case 'add': return 'bg-green-400';
      case 'subtract': return 'bg-red-400';
      case 'total': return 'bg-blue-600';
      default: return 'bg-gray-400';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className={`${className}`}>
      <div className="relative h-64 flex items-end gap-2 pt-8">
        {processedSteps.map((step, index) => (
          <motion.div
            key={step.name}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="relative flex-1 h-full"
            style={{ originY: 1 }}
          >
            {/* Bar */}
            <div className="absolute inset-x-0 bottom-0 h-full">
              <div
                className={`absolute inset-x-1 ${getColor(step)} rounded-t-md transition-all duration-300`}
                style={getBarStyle(step)}
              >
                {/* Value label */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className={`text-xs font-semibold ${
                    step.type === 'subtract' ? 'text-red-600' : 
                    step.type === 'total' ? 'text-blue-700' : 'text-gray-700'
                  } dark:text-gray-200`}>
                    {step.type === 'subtract' && '-'}
                    {formatCurrency(step.type === 'total' ? step.value : Math.abs(step.end - step.start))}
                  </span>
                </div>
              </div>
              
              {/* Connector line */}
              {index < processedSteps.length - 1 && step.type !== 'total' && (
                <div 
                  className="absolute right-0 w-4 border-t-2 border-dashed border-gray-300 dark:border-gray-600"
                  style={{ 
                    top: `${((maxValue - step.end) / range) * 100}%`,
                    transform: 'translateX(100%)'
                  }}
                />
              )}
            </div>
            
            {/* Label */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-full">
              <p className="text-xs text-center text-gray-600 dark:text-gray-400 truncate px-1">
                {step.name}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Zero line indicator */}
      <div className="h-px bg-gray-300 dark:bg-gray-600 mt-2" />
      <div className="h-10" /> {/* Space for labels */}
    </div>
  );
}

// Animated Counter Component
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({ 
  value, 
  duration = 1000, 
  prefix = '', 
  suffix = '',
  decimals = 2,
  className = '' 
}: AnimatedCounterProps) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={className}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration / 1000 }}
      >
        {prefix}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration / 1000 }}
        >
          {value.toLocaleString('en-US', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
          })}
        </motion.span>
        {suffix}
      </motion.span>
    </motion.span>
  );
}
