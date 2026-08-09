"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import { KeyboardEvent, useId, useMemo, useState } from "react";
import {
  filterDirectorySuggestions,
  type DirectorySearchItem,
} from "./directory-search";
import styles from "./directory-typeahead.module.css";

type Props = {
  id: string;
  label: string;
  placeholder: string;
  items: readonly DirectorySearchItem[];
  value?: string;
  onValueChange?: (value: string) => void;
};

export function DirectoryTypeahead({
  id,
  label,
  placeholder,
  items,
  value,
  onValueChange,
}: Props) {
  const router = useRouter();
  const reactId = useId();
  const [internalValue, setInternalValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = value ?? internalValue;
  const matches = useMemo(
    () => filterDirectorySuggestions(items, query),
    [items, query],
  );
  const suggestions = matches.slice(0, 6);
  const listboxId = `${id}-${reactId.replace(/:/g, "")}-suggestions`;

  function updateQuery(nextValue: string) {
    if (onValueChange) onValueChange(nextValue);
    else setInternalValue(nextValue);
    setActiveIndex(0);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      );
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const selection = suggestions[activeIndex];
      if (selection) router.push(selection.href);
    }
  }

  return (
    <div
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.field} role="search">
        <Search size={18} strokeWidth={1.7} aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && suggestions[activeIndex]
              ? `${listboxId}-${activeIndex}`
              : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            className={styles.clear}
            type="button"
            aria-label={`Clear ${label.toLocaleLowerCase("en-NG")}`}
            onClick={() => updateQuery("")}
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className={styles.suggestions} id={listboxId} role="listbox">
          <p className={styles.suggestionMeta} aria-live="polite">
            {query.trim()
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"}`
              : "Suggested profiles"}
          </p>
          {suggestions.length ? (
            suggestions.map((item, index) => (
              <Link
                id={`${listboxId}-${index}`}
                href={item.href}
                key={item.href}
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => setOpen(false)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            ))
          ) : (
            <p className={styles.empty}>No profile matches “{query.trim()}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
