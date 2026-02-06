/**
 * PatternPickerPanel - Professional grid-based pattern picker with search, categories,
 * thumbnails, favorites, and recently used patterns
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Settings, Star } from 'lucide-react';
import { useAppStore } from '../../../state/appStore';
import { PatternPreview } from './PatternPreview';
import { BUILTIN_PATTERNS } from '../../../types/hatch';
import type { CustomHatchPattern, PatternCategory } from '../../../types/hatch';
import type { HatchPatternType } from '../../../types/geometry';

interface PatternPickerPanelProps {
  value: HatchPatternType;
  customPatternId?: string;
  onChange: (patternType: HatchPatternType, customPatternId?: string) => void;
}

const CATEGORY_LABELS: Record<PatternCategory | 'all', string> = {
  all: 'All',
  basic: 'Basic',
  hatching: 'Hatching',
  material: 'Material',
  geometric: 'Geometric',
  custom: 'Custom',
};

const CATEGORY_ORDER: (PatternCategory | 'all')[] = ['all', 'basic', 'hatching', 'material', 'geometric', 'custom'];

function getPatternCategory(pattern: CustomHatchPattern): PatternCategory {
  if (pattern.category) return pattern.category;
  if (pattern.source === 'user' || pattern.source === 'project' || pattern.source === 'imported') return 'custom';
  return 'basic';
}

function getSelectedPatternId(value: HatchPatternType, customPatternId?: string): string {
  if (value === 'custom' && customPatternId) return customPatternId;
  return value;
}

export function PatternPickerPanel({ value, customPatternId, onChange }: PatternPickerPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<PatternCategory | 'all'>('all');
  const [hoveredPatternId, setHoveredPatternId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const userPatterns = useAppStore(s => s.userPatterns);
  const projectPatterns = useAppStore(s => s.projectPatterns);
  const setPatternManagerOpen = useAppStore(s => s.setPatternManagerOpen);
  const favoritePatternIds = useAppStore(s => s.favoritePatternIds);
  const recentPatternIds = useAppStore(s => s.recentPatternIds);
  const toggleFavoritePattern = useAppStore(s => s.toggleFavoritePattern);
  const addRecentPattern = useAppStore(s => s.addRecentPattern);
  const setPreviewPatternId = useAppStore(s => s.setPreviewPatternId);

  const allPatterns = useMemo(() => {
    const customs = [...userPatterns, ...projectPatterns];
    return [
      ...BUILTIN_PATTERNS,
      ...customs,
    ];
  }, [userPatterns, projectPatterns]);

  const patternMap = useMemo(() => {
    const map = new Map<string, CustomHatchPattern>();
    for (const p of allPatterns) map.set(p.id, p);
    return map;
  }, [allPatterns]);

  const selectedId = getSelectedPatternId(value, customPatternId);

  const selectedPattern = useMemo(() => {
    return patternMap.get(selectedId) ?? BUILTIN_PATTERNS[0];
  }, [patternMap, selectedId]);

  // Resolve recent patterns (only those that still exist)
  const recentPatterns = useMemo(() => {
    return recentPatternIds
      .map(id => patternMap.get(id))
      .filter((p): p is CustomHatchPattern => p !== undefined);
  }, [recentPatternIds, patternMap]);

  // Resolve favorite patterns (only those that still exist)
  const favoritePatterns = useMemo(() => {
    return favoritePatternIds
      .map(id => patternMap.get(id))
      .filter((p): p is CustomHatchPattern => p !== undefined);
  }, [favoritePatternIds, patternMap]);

  // Filter patterns by search and category
  const filteredPatterns = useMemo(() => {
    return allPatterns.filter(p => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch) return false;
      }
      // Category filter
      if (activeCategory !== 'all') {
        if (getPatternCategory(p) !== activeCategory) return false;
      }
      return true;
    });
  }, [allPatterns, search, activeCategory]);

  // Count patterns per category (for showing which tabs have content)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allPatterns.length };
    for (const p of allPatterns) {
      const cat = getPatternCategory(p);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [allPatterns]);

  const handleSelect = useCallback((pattern: CustomHatchPattern) => {
    addRecentPattern(pattern.id);
    setPreviewPatternId(null);
    if (pattern.source === 'builtin') {
      onChange(pattern.id as HatchPatternType);
    } else {
      onChange('custom', pattern.id);
    }
    setOpen(false);
    setSearch('');
  }, [onChange, addRecentPattern, setPreviewPatternId]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, patternId: string) => {
    e.stopPropagation();
    toggleFavoritePattern(patternId);
  }, [toggleFavoritePattern]);

  const handleOpenManager = useCallback(() => {
    setOpen(false);
    setSearch('');
    setPatternManagerOpen(true);
  }, [setPatternManagerOpen]);

  // Close on click outside
  useEffect(() => {
    if (!open) {
      setPreviewPatternId(null);
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        setPreviewPatternId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setPreviewPatternId]);

  // Focus search on open
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const isFavorite = useCallback((id: string) => favoritePatternIds.includes(id), [favoritePatternIds]);

  // Shared pattern tile renderer
  const renderPatternTile = (pattern: CustomHatchPattern, size: 'small' | 'normal' = 'normal') => {
    const isSelected = pattern.id === selectedId;
    const isHovered = pattern.id === hoveredPatternId;
    const fav = isFavorite(pattern.id);
    const w = size === 'small' ? 36 : 48;
    const h = size === 'small' ? 24 : 36;

    return (
      <button
        key={pattern.id}
        type="button"
        className={`relative flex flex-col items-center p-1.5 rounded transition-colors cursor-pointer group ${
          isSelected
            ? 'bg-cad-accent/20 ring-1 ring-cad-accent'
            : isHovered
              ? 'bg-cad-hover'
              : 'hover:bg-cad-hover'
        }`}
        onClick={() => handleSelect(pattern)}
        onMouseEnter={() => { setHoveredPatternId(pattern.id); setPreviewPatternId(pattern.id); }}
        onMouseLeave={() => { setHoveredPatternId(null); setPreviewPatternId(null); }}
        title={`${pattern.name}${pattern.description ? '\n' + pattern.description : ''}`}
      >
        {/* Favorite star */}
        <span
          className={`absolute top-0.5 right-0.5 transition-opacity ${
            fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          }`}
          onClick={(e) => handleToggleFavorite(e, pattern.id)}
          title={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            size={10}
            className={fav ? 'fill-yellow-400 text-yellow-400' : 'text-cad-text-dim'}
          />
        </span>

        <PatternPreview
          pattern={pattern}
          width={w}
          height={h}
          scale={size === 'small' ? 0.5 : 0.7}
        />
        <span className="text-[10px] mt-1 truncate w-full text-center text-cad-text">
          {pattern.name}
        </span>
      </button>
    );
  };

  return (
    <div className="mb-2 relative" ref={ref}>
      <label className="block text-xs text-cad-text-dim mb-1">Pattern Type</label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-cad-bg border border-cad-border rounded px-2 py-1 text-xs text-cad-text flex items-center gap-2 cursor-pointer text-left hover:border-cad-accent transition-colors"
      >
        <PatternPreview pattern={selectedPattern} width={32} height={18} scale={0.5} />
        <span className="flex-1 truncate">{selectedPattern.name}</span>
        <span className="text-cad-text-dim text-[10px]">&#9662;</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-cad-surface border border-cad-border rounded shadow-lg overflow-hidden"
          style={{ minWidth: '240px' }}
        >
          {/* Search box */}
          <div className="p-2 border-b border-cad-border">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-cad-text-dim" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search patterns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-cad-bg border border-cad-border rounded pl-7 pr-2 py-1 text-xs text-cad-text placeholder:text-cad-text-dim/50 focus:outline-none focus:border-cad-accent"
              />
            </div>
          </div>

          {/* Recent patterns row */}
          {!search && recentPatterns.length > 0 && (
            <div className="px-2 pt-2 pb-1 border-b border-cad-border">
              <div className="text-[10px] text-cad-text-dim uppercase tracking-wide mb-1">Recent</div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {recentPatterns.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex-shrink-0 flex flex-col items-center p-1 rounded transition-colors cursor-pointer ${
                      p.id === selectedId ? 'bg-cad-accent/20 ring-1 ring-cad-accent' : 'hover:bg-cad-hover'
                    }`}
                    onClick={() => handleSelect(p)}
                    title={p.name}
                  >
                    <PatternPreview pattern={p} width={32} height={22} scale={0.5} />
                    <span className="text-[9px] mt-0.5 truncate text-center text-cad-text" style={{ maxWidth: '36px' }}>
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Favorites row */}
          {!search && favoritePatterns.length > 0 && (
            <div className="px-2 pt-2 pb-1 border-b border-cad-border">
              <div className="flex items-center gap-1 mb-1">
                <Star size={10} className="fill-yellow-400 text-yellow-400" />
                <span className="text-[10px] text-cad-text-dim uppercase tracking-wide">Favorites</span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {favoritePatterns.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`flex-shrink-0 flex flex-col items-center p-1 rounded transition-colors cursor-pointer ${
                      p.id === selectedId ? 'bg-cad-accent/20 ring-1 ring-cad-accent' : 'hover:bg-cad-hover'
                    }`}
                    onClick={() => handleSelect(p)}
                    title={p.name}
                  >
                    <PatternPreview pattern={p} width={32} height={22} scale={0.5} />
                    <span className="text-[9px] mt-0.5 truncate text-center text-cad-text" style={{ maxWidth: '36px' }}>
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category tabs */}
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-cad-border overflow-x-auto">
            {CATEGORY_ORDER.filter(cat => cat === 'all' || (categoryCounts[cat] || 0) > 0).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-cad-accent text-white'
                    : 'bg-cad-bg text-cad-text-dim hover:bg-cad-hover hover:text-cad-text'
                }`}
              >
                {CATEGORY_LABELS[cat]}
                {cat !== 'all' && <span className="ml-1 opacity-60">({categoryCounts[cat] || 0})</span>}
              </button>
            ))}
          </div>

          {/* Pattern grid */}
          <div className="max-h-[240px] overflow-y-auto p-2">
            {filteredPatterns.length === 0 ? (
              <div className="text-center py-4 text-xs text-cad-text-dim">
                No patterns found
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {filteredPatterns.map((pattern) => renderPatternTile(pattern))}
              </div>
            )}
          </div>

          {/* Manage Patterns link */}
          <div className="border-t border-cad-border px-2 py-1.5">
            <button
              type="button"
              onClick={handleOpenManager}
              className="flex items-center gap-1.5 text-xs text-cad-accent hover:text-cad-text transition-colors w-full"
            >
              <Settings size={12} />
              <span>Manage Patterns...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
