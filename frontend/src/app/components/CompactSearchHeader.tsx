import { Search, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { SearchScope, SearchSuggestion } from '../../types/entities';
import { fetchSearchSuggestions } from '../lib/app-service';
import { buildSearchRoute } from '../lib/routes';

export function CompactSearchHeader({
  scope = 'all',
  placeholder = '搜索',
  value,
  onValueChange,
  onSubmit,
  trailing,
  title,
  sticky = true,
}: {
  scope?: SearchScope;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  trailing?: ReactNode;
  title?: string;
  sticky?: boolean;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const keyword = value ?? localValue;
  const setKeyword = onValueChange ?? setLocalValue;

  useEffect(() => {
    if (!expanded) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    void fetchSearchSuggestions().then((items) => {
      setSuggestions(items.filter((item) => scope === 'all' || item.scope === scope).slice(0, 5));
    }).catch(() => setSuggestions([]));
    return () => window.cancelAnimationFrame(frame);
  }, [expanded, scope]);

  useEffect(() => {
    if (!expanded) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expanded]);

  function submit(next = keyword) {
    const normalized = next.trim();
    if (!normalized) return;
    if (onSubmit) {
      onSubmit(normalized);
      return;
    }
    navigate(buildSearchRoute({ keyword: normalized, scope }));
  }

  return (
    <header className={`${sticky ? 'sticky top-0 z-30' : 'relative z-30'} -mx-4 bg-[rgba(237,241,247,0.86)] px-4 pb-3 pt-2 backdrop-blur-[22px] backdrop-saturate-150`}>
      <div className="flex min-h-11 items-center gap-2">
        {!expanded && title ? <div className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-7 text-slate-950">{title}</div> : null}
        <div className={`relative ${expanded ? 'min-w-0 flex-1' : 'w-[6.5rem]'}`}>
          {expanded ? (
            <div className="search-material flex h-11 w-full items-center rounded-[14px] border border-white/90 bg-white/92 px-3 shadow-[0_7px_22px_rgba(29,45,72,0.09)]">
              <Search size={18} strokeWidth={2.3} className="shrink-0 text-blue-600" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && submit()}
                onClick={(event) => event.stopPropagation()}
                aria-label={placeholder}
                autoComplete="off"
                placeholder={placeholder}
                className="app-bare-input ml-2 min-w-0 flex-1 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
              />
              {keyword ? (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => { setKeyword(''); inputRef.current?.focus(); }}
                  className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              aria-expanded={false}
              aria-label={placeholder}
              onClick={() => setExpanded(true)}
              className={`search-material flex h-11 w-full items-center border border-white/90 bg-white/92 text-left shadow-[0_7px_22px_rgba(29,45,72,0.09)] ${title ? 'rounded-full px-3' : 'rounded-[14px] px-3.5'}`}
            >
              <Search size={18} strokeWidth={2.3} className="shrink-0 text-blue-600" aria-hidden="true" />
              <span className={`ml-2 truncate text-sm font-medium ${keyword ? 'text-blue-700' : 'text-slate-500'}`}>{keyword || (title ? '搜索' : placeholder)}</span>
            </button>
          )}

          {expanded && !keyword && suggestions.length > 0 ? (
            <div className="absolute inset-x-0 top-[3.25rem] overflow-hidden rounded-lg border border-white/80 bg-white/96 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setKeyword(item.label); submit(item.label); }}
                  className="flex min-h-11 w-full items-center border-b border-slate-100 px-3.5 text-left text-sm font-medium text-slate-700 last:border-0 active:bg-slate-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {expanded ? (
          <button type="button" onClick={() => setExpanded(false)} className="min-h-11 shrink-0 px-1 text-sm font-semibold text-blue-600 active:opacity-60">
            取消
          </button>
        ) : trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}
