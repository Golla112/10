'use client';

export default function SkeletonLoader({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-gray-800 p-4">
          <div className="mb-2 h-4 w-3/4 rounded bg-gray-700" />
          <div className="h-3 w-1/2 rounded bg-gray-700" />
        </div>
      ))}
    </div>
  );
}
