"use client";

import { Button } from "@heroui/react";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export default function Pagination({
  total,
  limit,
  offset,
  onChange,
}: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-default-500">
        共 {total} 条，第 {currentPage}/{totalPages} 页
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          isDisabled={offset === 0}
          onPress={() => onChange(Math.max(0, offset - limit))}
        >
          上一页
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isDisabled={offset + limit >= total}
          onPress={() => onChange(offset + limit)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
