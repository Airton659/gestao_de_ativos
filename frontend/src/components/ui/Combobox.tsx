import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
  id: string | number;
  label: string;
}

interface ComboboxProps {
  options: Option[];
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

export const Combobox = ({ options, value, onChange, placeholder = "Selecione...", disabled, className, error }: ComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(() => options.find(o => String(o.id) === String(value)), [options, value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm transition-all outline-none border border-transparent hover:border-slate-200",
          isOpen ? "ring-2 ring-[#0000A0] bg-white shadow-sm border-white" : "",
          error && "ring-2 ring-red-400",
          disabled && "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
        )}
      >
        <span className={cn("truncate font-medium", !selectedOption && "text-slate-400 font-normal")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={cn("text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in duration-150 origin-top">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="h-9 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-xs font-bold outline-none ring-[#0000A0] focus:ring-1"
            />
          </div>
          
          <div className="max-h-[250px] overflow-y-auto no-scrollbar space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="p-4 text-center text-[10px] font-black tracking-wide text-slate-400">NENHUM RESULTADO</p>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors hover:bg-slate-50",
                    String(opt.id) === String(value) ? "bg-blue-50 text-[#0000A0]" : "text-slate-600"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {String(opt.id) === String(value) && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
