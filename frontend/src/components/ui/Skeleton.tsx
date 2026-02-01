'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  const animationClasses = animate ? 'animate-pulse' : '';

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div
      className={`${baseClasses} ${animationClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Pre-built skeleton layouts
export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      <Skeleton variant="text" height={24} width="60%" />
      <div className="space-y-2">
        <Skeleton variant="text" height={16} />
        <Skeleton variant="text" height={16} />
        <Skeleton variant="text" height={16} width="80%" />
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <Skeleton variant="text" height={28} width="40%" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton variant="text" height={16} width="30%" />
            <Skeleton variant="rectangular" height={40} />
          </div>
          <div className="space-y-2">
            <Skeleton variant="text" height={16} width="30%" />
            <Skeleton variant="rectangular" height={40} />
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <Skeleton variant="text" height={28} width="40%" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" height={16} width="40%" />
              <Skeleton variant="rectangular" height={40} />
            </div>
          ))}
        </div>
      </div>
      <Skeleton variant="rectangular" height={48} />
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div className="space-y-6">
      {/* Main result card */}
      <div className="bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 rounded-lg shadow-lg p-6 animate-pulse">
        <div className="text-center space-y-2">
          <Skeleton variant="text" height={14} width="30%" className="mx-auto bg-gray-400 dark:bg-gray-500" />
          <Skeleton variant="text" height={48} width="50%" className="mx-auto bg-gray-400 dark:bg-gray-500" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="text-center space-y-2">
            <Skeleton variant="text" height={14} width="50%" className="mx-auto bg-gray-400 dark:bg-gray-500" />
            <Skeleton variant="text" height={28} width="70%" className="mx-auto bg-gray-400 dark:bg-gray-500" />
          </div>
          <div className="text-center space-y-2">
            <Skeleton variant="text" height={14} width="50%" className="mx-auto bg-gray-400 dark:bg-gray-500" />
            <Skeleton variant="text" height={28} width="70%" className="mx-auto bg-gray-400 dark:bg-gray-500" />
          </div>
        </div>
      </div>

      {/* Chart skeleton */}
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" height={16} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="border-b border-gray-100 dark:border-gray-700 p-4 flex gap-4"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" height={16} className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
