import { Loader2 } from 'lucide-react';

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'list' | 'full';
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({ 
  type = 'card', 
  count = 4, 
  className = '' 
}: LoadingSkeletonProps) {
  const renderCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-xl animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-5 sm:h-6 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse w-3/4" />
          <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse w-1/2" />
          <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse w-1/3" />
        </div>
      </div>
    </div>
  );

  const renderTableSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
      <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 animate-pulse" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <div className="flex-1 h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse" />
          <div className="w-24 h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse" />
          <div className="w-16 h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  );

  const renderListSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse w-3/4" />
            <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-lg animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderFullSkeleton = () => (
    <div className="flex items-center justify-center py-12 sm:py-16">
      <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-teal-600" />
    </div>
  );

  return (
    <div className={className}>
      {type === 'card' && (
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i}>{renderCardSkeleton()}</div>
          ))}
        </div>
      )}
      {type === 'table' && renderTableSkeleton()}
      {type === 'list' && renderListSkeleton()}
      {type === 'full' && renderFullSkeleton()}
    </div>
  );
}
