import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Always show: first, last, current, current±1
  const rawPages = [1, totalPages, page - 1, page, page + 1].filter(
    (p) => p >= 1 && p <= totalPages
  );
  const pageList = [...new Set(rawPages)].sort((a, b) => a - b);

  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-[10px] font-black tracking-widest text-slate-400">
        {start}–{end} DE {total}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {pageList.map((p, i) => {
          const prev = pageList[i - 1];
          const gap = prev !== undefined && p - prev > 1;
          return (
            <div key={p} className="flex items-center gap-1">
              {gap && (
                <span className="w-5 text-center text-[10px] font-black text-slate-300">…</span>
              )}
              <button
                onClick={() => onPageChange(p)}
                className={cn(
                  'h-8 w-8 rounded-lg text-[10px] font-black transition-colors',
                  p === page
                    ? 'bg-[#0000A0] text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {p}
              </button>
            </div>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
