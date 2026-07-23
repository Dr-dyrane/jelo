'use client';

import { Check, Plus, Search, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AdaptiveValue } from '@/lib/community-intake/schema';
import { normalizeCommunityValue } from '@/lib/community-intake/schema';
import styles from './adaptive-selector.module.css';

export type AdaptiveOption = {
  id: string;
  label: string;
  aliases?: string[];
  detail?: string;
};

type InputMode = 'tap' | 'search' | 'type' | 'custom';

type AdaptiveSelectorProps = {
  label: string;
  hint?: string;
  mode: 'single' | 'multiple';
  value: AdaptiveValue[];
  suggestions: AdaptiveOption[];
  allowCustom?: boolean;
  searchable?: boolean;
  searchOptions?: (query: string, signal: AbortSignal) => Promise<AdaptiveOption[]>;
  onChange: (value: AdaptiveValue[]) => void;
  onInteraction?: (mode: InputMode, resultsCount: number) => void;
};

function matches(option: AdaptiveOption, query: string) {
  const needle = normalizeCommunityValue(query);
  if (!needle) return true;
  return [option.label, ...(option.aliases ?? []), option.detail ?? '']
    .some(value => normalizeCommunityValue(value).includes(needle));
}

export function AdaptiveSelector({
  label,
  hint,
  mode,
  value,
  suggestions,
  allowCustom = true,
  searchable = true,
  searchOptions,
  onChange,
  onInteraction,
}: AdaptiveSelectorProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const statusId = `${inputId}-status`;
  const [query, setQuery] = useState('');
  const [remoteOptions, setRemoteOptions] = useState<AdaptiveOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const recordedSearch = useRef(false);

  useEffect(() => {
    if (!searchOptions || query.trim().length < 2) return;
    const controller = new AbortController();
    searchOptions(query.trim(), controller.signal)
      .then(options => setRemoteOptions(options.slice(0, 20)))
      .catch(() => { if (!controller.signal.aborted) setRemoteOptions([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, searchOptions]);

  const options = useMemo(() => {
    const merged = new Map<string, AdaptiveOption>();
    for (const option of [...suggestions, ...remoteOptions]) merged.set(option.id, option);
    return [...merged.values()].filter(option => matches(option, query)).slice(0, 12);
  }, [query, remoteOptions, suggestions]);

  const exactMatch = options.some(option => normalizeCommunityValue(option.label) === normalizeCommunityValue(query));
  const canAdd = allowCustom && query.trim().length >= 2 && !exactMatch;
  const resultCount = options.length + (canAdd ? 1 : 0);
  const resolvedActiveIndex = resultCount ? Math.min(activeIndex, resultCount - 1) : 0;

  function choose(next: AdaptiveValue, inputMode: InputMode) {
    const selected = value.some(item => item.id === next.id);
    const updated = mode === 'single'
      ? [next]
      : selected
        ? value.filter(item => item.id !== next.id)
        : [...value, next];
    onChange(updated);
    onInteraction?.(inputMode, resultCount);
    if (mode === 'single') {
      setQuery('');
      setActiveIndex(0);
      setRemoteOptions([]);
    }
  }

  function addCustom() {
    const labelValue = query.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!labelValue) return;
    choose({ id: `custom:${normalizeCommunityValue(labelValue)}`, label: labelValue, source: 'custom' }, 'custom');
    setQuery('');
    setActiveIndex(0);
    setRemoteOptions([]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!resultCount) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((resolvedActiveIndex + 1) % resultCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((resolvedActiveIndex - 1 + resultCount) % resultCount);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (resolvedActiveIndex < options.length) {
        const option = options[resolvedActiveIndex];
        choose({ id: option.id, label: option.label, source: 'canonical' }, query ? 'search' : 'tap');
      } else if (canAdd) addCustom();
    } else if (event.key === 'Escape') {
      setQuery('');
    }
  }

  return (
    <div className={styles.selector}>
      <div className={styles.heading}>
        {searchable ? <label htmlFor={inputId}>{label}</label> : <h2>{label}</h2>}
        {hint ? <p>{hint}</p> : null}
      </div>

      {value.length ? <div className={styles.selected} aria-label="Selected">
        {value.map(item => <button key={item.id} type="button" onClick={() => choose(item, 'tap')}>
          <Check size={14} aria-hidden="true" /> {item.label} <X size={13} aria-hidden="true" />
        </button>)}
      </div> : null}

      {searchable ? <div className={styles.searchBox}>
        <Search size={18} aria-hidden="true" />
        <input
          id={inputId}
          value={query}
          onChange={event => {
            const next = event.target.value;
            setQuery(next);
            setActiveIndex(0);
            if (searchOptions && next.trim().length >= 2) setLoading(true);
            if (next.trim().length < 2) {
              setRemoteOptions([]);
              setLoading(false);
            }
            if (next && !recordedSearch.current) {
              recordedSearch.current = true;
              onInteraction?.('search', options.length);
            }
            if (!next) recordedSearch.current = false;
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded="true"
          aria-activedescendant={resultCount ? `${listId}-${resolvedActiveIndex}` : undefined}
          aria-describedby={statusId}
          placeholder={allowCustom ? 'Search or add' : 'Search'}
          autoComplete="off"
        />
      </div> : null}

      <div className={styles.options} id={listId} role="listbox" aria-label={label} aria-multiselectable={mode === 'multiple'}>
        {options.map((option, index) => {
          const selected = value.some(item => item.id === option.id);
          return <button
            id={`${listId}-${index}`}
            key={option.id}
            type="button"
            role="option"
            aria-selected={selected}
            data-active={resolvedActiveIndex === index}
            onClick={() => choose({ id: option.id, label: option.label, source: 'canonical' }, query ? 'search' : 'tap')}
          >
            <span><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span>
            <span className={styles.optionMark}>{selected ? <Check size={16} aria-hidden="true" /> : null}</span>
          </button>;
        })}
        {canAdd ? <button
          id={`${listId}-${options.length}`}
          type="button"
          role="option"
          aria-selected="false"
          data-active={resolvedActiveIndex === options.length}
          className={styles.addOption}
          onClick={addCustom}
        >
          <Plus size={17} aria-hidden="true" /> <span>Add “{query.trim()}”</span>
        </button> : null}
      </div>

      <p className="sr-only" id={statusId} role="status" aria-live="polite">
        {loading ? 'Searching.' : `${resultCount} ${resultCount === 1 ? 'option' : 'options'}. ${value.length} selected.`}
      </p>
    </div>
  );
}
