"use client";

import { Check, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type {
  LocationSuggestion,
  SmartLocationValue,
} from "@/lib/location/model";
import {
  NIGERIA_STATES,
  nigeriaCitySuggestions,
  normalizeNigeriaState,
} from "@/lib/location/nigeria";
import styles from "./smart-location-fields.module.css";

const EMPTY_SUGGESTIONS: LocationSuggestion[] = [];

export function SmartLocationFields({
  value,
  onChange,
  idPrefix,
  disabled = false,
}: {
  value: SmartLocationValue;
  onChange: (value: SmartLocationValue) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const cityListId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const [suggestions, setSuggestions] =
    useState<LocationSuggestion[]>(EMPTY_SUGGESTIONS);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "unavailable"
  >("idle");
  const [provider, setProvider] = useState<
    "geoapify" | "mapbox" | "openstreetmap" | null
  >(null);
  const [focused, setFocused] = useState(false);
  const citySuggestions = nigeriaCitySuggestions(value.state);
  const open = focused && suggestions.length > 0;

  useEffect(() => {
    const query = value.address.trim();
    abortRef.current?.abort();
    if (query.length < 4 || disabled) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch("/api/locations/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            query,
            city: value.city,
            state: value.state || undefined,
          }),
        });
        const payload = (await response.json()) as {
          suggestions?: LocationSuggestion[];
          provider?: "geoapify" | "mapbox" | "openstreetmap";
        };
        if (controller.signal.aborted) return;
        const next =
          response.ok && Array.isArray(payload.suggestions)
            ? payload.suggestions
            : EMPTY_SUGGESTIONS;
        setSuggestions(next);
        setActiveIndex(next.length ? 0 : -1);
        setProvider(response.ok && payload.provider ? payload.provider : null);
        setStatus(response.ok ? "ready" : "unavailable");
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return;
        setSuggestions(EMPTY_SUGGESTIONS);
        setStatus("unavailable");
      }
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, value.address, value.city, value.state]);

  function choose(suggestion: LocationSuggestion) {
    abortRef.current?.abort();
    onChange({
      address: suggestion.address,
      city: suggestion.city,
      state: normalizeNigeriaState(suggestion.state) ?? value.state,
      postalCode: suggestion.postalCode,
    });
    setSuggestions(EMPTY_SUGGESTIONS);
    setStatus("ready");
    setActiveIndex(-1);
  }

  return (
    <div className={styles.fields}>
      <label className={styles.fullField}>
        <span>Street address</span>
        <div className={styles.combobox}>
          <MapPin size={18} aria-hidden="true" />
          <input
            id={`${idPrefix}-address`}
            name="address"
            autoComplete="street-address"
            required
            minLength={5}
            maxLength={500}
            disabled={disabled}
            value={value.address}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              open && activeIndex >= 0
                ? `${listboxId}-${activeIndex}`
                : undefined
            }
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            onChange={(event) => {
              const address = event.target.value;
              if (address.trim().length < 4) {
                setSuggestions(EMPTY_SUGGESTIONS);
                setStatus("idle");
                setActiveIndex(-1);
              }
              onChange({ ...value, address });
            }}
            onKeyDown={(event) => {
              if (!open) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((activeIndex + 1) % suggestions.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex(
                  (activeIndex - 1 + suggestions.length) % suggestions.length,
                );
              } else if (event.key === "Enter" && activeIndex >= 0) {
                event.preventDefault();
                choose(suggestions[activeIndex]);
              } else if (event.key === "Escape") {
                setSuggestions(EMPTY_SUGGESTIONS);
              }
            }}
          />
          {status === "loading" ? (
            <LoaderCircle
              className={styles.spinner}
              size={17}
              aria-hidden="true"
            />
          ) : null}
          {open ? (
            <div
              id={listboxId}
              className={styles.suggestions}
              role="listbox"
              aria-label="Nigerian address suggestions"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  id={`${listboxId}-${index}`}
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(suggestion)}
                >
                  <span>{suggestion.label}</span>
                  {index === activeIndex ? (
                    <Check size={16} aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <small className={styles.help} aria-live="polite">
          {status === "unavailable"
            ? "Suggestions are unavailable. Keep typing manually."
            : "Type normally or choose a Nigerian address suggestion."}
        </small>
      </label>

      <label>
        <span>State</span>
        <select
          id={`${idPrefix}-state`}
          name="state"
          autoComplete="address-level1"
          required
          disabled={disabled}
          value={value.state}
          onChange={(event) =>
            onChange({ ...value, state: event.target.value, city: "" })
          }
        >
          <option value="">Choose state</option>
          {NIGERIA_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>City or area</span>
        <input
          id={`${idPrefix}-city`}
          name="city"
          list={citySuggestions.length ? cityListId : undefined}
          autoComplete="address-level2"
          required
          minLength={2}
          maxLength={120}
          disabled={disabled}
          value={value.city}
          onChange={(event) => onChange({ ...value, city: event.target.value })}
        />
        {citySuggestions.length ? (
          <datalist id={cityListId}>
            {citySuggestions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        ) : null}
      </label>

      <label className={styles.fullField}>
        <span>
          Postcode <small>optional</small>
        </span>
        <input
          id={`${idPrefix}-postal-code`}
          name="postalCode"
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={20}
          disabled={disabled}
          value={value.postalCode}
          onChange={(event) =>
            onChange({ ...value, postalCode: event.target.value })
          }
        />
      </label>

      <p className={styles.attribution}>
        Suggestions send the typed location to{" "}
        {provider === "openstreetmap"
          ? "OpenStreetMap"
          : provider === "mapbox"
            ? "Mapbox"
            : "Geoapify"}{" "}
        and are not saved by JeloCare until you submit.{" "}
        {provider === "openstreetmap" ? (
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap contributors
          </a>
        ) : provider === "mapbox" ? (
          <a
            href="https://www.mapbox.com/about/maps/"
            target="_blank"
            rel="noreferrer"
          >
            © Mapbox
          </a>
        ) : (
          <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
            Powered by Geoapify
          </a>
        )}
        .
      </p>
    </div>
  );
}
