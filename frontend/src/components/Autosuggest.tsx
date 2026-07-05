import { useState, useEffect, useRef } from "react";

interface AutoOption { id: number; title: string; }

export function Autosuggest({ label, value, options, onChange, placeholder }: {
  label: string; value: string; options: AutoOption[];
  onChange: (id: number) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? options.filter(o => o.title.toLowerCase().includes(query.toLowerCase()))
    : options.slice(0, 10);

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type="text" value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} className="input" placeholder={placeholder} />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <div key={o.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-brand-50 border-b border-slate-100 last:border-0"
              onClick={() => { onChange(o.id); setQuery(o.title); setOpen(false); }}>
              <span className="text-slate-400 text-xs mr-2">#{o.id}</span>{o.title}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm text-slate-400">No matches</div>
      )}
    </div>
  );
}
