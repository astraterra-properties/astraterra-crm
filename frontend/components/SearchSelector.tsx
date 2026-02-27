'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchSelectorProps {
  label: string;
  value: number | null;
  displayValue: string;
  placeholder: string;
  onSearch: (q: string) => void;
  options: any[];
  onSelect: (item: any) => void;
  onClear: () => void;
  renderOption: (item: any) => React.ReactNode;
  required?: boolean;
}

export default function SearchSelector({
  label, value, displayValue, placeholder, onSearch,
  options, onSelect, onClear, renderOption, required,
}: SearchSelectorProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { if (query.trim()) onSearch(query); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const inputStyle = { borderColor: '#E5E7EB', color: '#374151', background: 'white' };

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {value ? (
        <div className="flex items-center gap-2 px-3.5 py-2.5 text-sm border rounded-lg" style={inputStyle}>
          <span className="flex-1 font-medium truncate" style={{ color: '#131B2B' }}>{displayValue}</span>
          <button type="button" onClick={onClear} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => { setOpen(true); if (!query) onSearch(''); }}
              placeholder={placeholder}
              className="w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none"
              style={{ ...inputStyle, borderColor: open ? '#C9A96E' : '#E5E7EB' }}
            />
          </div>
          {open && options.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-52 overflow-y-auto" style={{ borderColor: '#E5E7EB' }}>
              {options.map((item) => (
                <button key={item.id} type="button"
                  className="w-full text-left px-4 py-2.5 border-b last:border-0 transition-colors"
                  style={{ borderColor: '#F3F4F6' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF9F0'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; }}
                  onClick={() => { onSelect(item); setQuery(''); setOpen(false); }}>
                  {renderOption(item)}
                </button>
              ))}
            </div>
          )}
          {open && query.trim().length >= 1 && options.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl px-4 py-3 text-sm" style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}>
              No results found
            </div>
          )}
        </>
      )}
    </div>
  );
}
