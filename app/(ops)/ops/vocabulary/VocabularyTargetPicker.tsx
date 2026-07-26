'use client';

import {
  Check,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import {
  rankVocabularyTargets,
  vocabularyDisplayTarget,
  vocabularyKindLabel,
  type VocabularyTarget,
  type VocabularyValueKind,
} from '@/lib/moderation/vocabulary-presentation';
import styles from './vocabulary.module.css';

const targetNouns: Record<VocabularyValueKind, string> = {
  product: 'product',
  retailer: 'store',
  brand: 'brand',
  purpose: 'use',
};

function targetLabel(target: VocabularyTarget) {
  return vocabularyDisplayTarget(target)?.label
    ?? `Unnamed ${vocabularyKindLabel(target.kind).toLocaleLowerCase('en-NG')}`;
}

function targetDetail(target: VocabularyTarget) {
  return vocabularyDisplayTarget(target)?.detail ?? null;
}

export function VocabularyTargetPicker({
  term,
  valueKind,
  targets,
  selected,
  disabled,
  onSelect,
}: {
  term: string;
  valueKind: VocabularyValueKind;
  targets: VocabularyTarget[];
  selected: VocabularyTarget | null;
  disabled: boolean;
  onSelect: (target: VocabularyTarget | null) => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const listId = `${inputId}-list`;
  const statusId = `${inputId}-status`;
  const {
    dialogRef,
    triggerRef,
    open,
    close,
  } = useModalDialog();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const noun = targetNouns[valueKind];
  const results = useMemo(
    () => rankVocabularyTargets(term, valueKind, targets, query).slice(0, 10),
    [query, targets, term, valueKind],
  );
  const resolvedIndex = results.length > 0
    ? Math.min(activeIndex, results.length - 1)
    : 0;

  function openPicker() {
    if (disabled) return;
    setQuery('');
    setActiveIndex(0);
    open();
    // The matching field is the task. The dialog helper focuses its first
    // control for generic dialogs, then this frame deliberately gives people
    // the immediate typeahead they came for.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function choose(target: VocabularyTarget) {
    onSelect(target);
    close();
    setQuery('');
    setActiveIndex(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (results.length > 0) choose(results[resolvedIndex]);
      return;
    }
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((resolvedIndex + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((resolvedIndex - 1 + results.length) % results.length);
    }
  }

  useEffect(() => {
    const option = document.getElementById(`${listId}-${resolvedIndex}`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [listId, resolvedIndex]);

  return (
    <div className={styles.targetPicker}>
      {selected ? (
        <div className={styles.selectedTarget}>
          <button
            ref={triggerRef}
            className={styles.selectedTargetMain}
            type="button"
            disabled={disabled}
            onClick={openPicker}
          >
            <span>
              <small>Same as known</small>
              <strong>{targetLabel(selected)}</strong>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button
            className={styles.clearTarget}
            type="button"
            disabled={disabled}
            aria-label={`Clear ${targetLabel(selected)}`}
            onClick={() => onSelect(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          className={styles.targetTrigger}
          type="button"
          disabled={disabled}
          onClick={openPicker}
        >
          <span>
            <small>Same as known</small>
            <strong>Find the {noun}</strong>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}

      <dialog
        ref={dialogRef}
        className={styles.targetDialog}
        aria-labelledby={titleId}
        onCancel={event => {
          event.preventDefault();
          close();
        }}
        onClick={event => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <section className={styles.targetSheet}>
          <header className={styles.targetSheetHeader}>
            <div>
              <span>Same as known</span>
              <h2 id={titleId}>Find the {noun}.</h2>
              <p>Choose only when it means the same thing.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close matches">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className={styles.targetSearch}>
            <Search size={17} aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              value={query}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={results.length > 0 ? `${listId}-${resolvedIndex}` : undefined}
              aria-describedby={statusId}
              autoComplete="off"
              placeholder={`Search ${vocabularyKindLabel(valueKind).toLocaleLowerCase('en-NG')}s`}
              onKeyDown={onKeyDown}
              onChange={event => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
            />
          </div>

          <div className={styles.targetResultsHeading}>
            {query.trim() ? 'Matches' : 'Possible matches'}
          </div>
          <div
            id={listId}
            className={styles.targetResults}
            role="listbox"
            aria-label={`${vocabularyKindLabel(valueKind)} matches`}
          >
            {results.map((target, index) => {
              const isSelected = selected?.kind === target.kind && selected.ref === target.ref;
              return (
                <button
                  id={`${listId}-${index}`}
                  key={`${target.kind}:${target.ref}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-active={resolvedIndex === index}
                  onClick={() => choose(target)}
                >
                  <span>
                    <strong>{targetLabel(target)}</strong>
                    {targetDetail(target) ? <small>{targetDetail(target)}</small> : null}
                  </span>
                  {isSelected ? <Check size={16} aria-hidden="true" /> : null}
                </button>
              );
            })}
            {results.length === 0 ? (
              <p>No close match yet.</p>
            ) : null}
          </div>
          <p id={statusId} className="sr-only" role="status" aria-live="polite">
            {`${results.length} ${results.length === 1 ? 'match' : 'matches'} shown.`}
          </p>
        </section>
      </dialog>

      <input type="hidden" name="canonicalEntityKind" value={selected?.kind ?? ''} />
      <input type="hidden" name="canonicalEntityRef" value={selected?.ref ?? ''} />
    </div>
  );
}
