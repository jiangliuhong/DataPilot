"use client";

interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({
  message = "暂无数据",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-default-400">{message}</p>
    </div>
  );
}
