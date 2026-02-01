'use client';

import { useState, useEffect, useCallback } from 'react';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  showValue?: boolean;
  className?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit = '',
  showValue = true,
  className = '',
  disabled = false,
}: SliderProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((newValue: number) => {
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const percentage = ((localValue - min) / (max - min)) * 100;

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
              {localValue}{unit}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={(e) => handleChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer 
            disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-600
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-blue-600
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:shadow-lg
            [&::-moz-range-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, #2563eb ${percentage}%, #e5e7eb ${percentage}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    </div>
  );
}
