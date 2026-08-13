"use client";

import { MapPin, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import {
  removeLocationAction,
  saveLocationAction,
} from "@/app/(customer)/me/actions";
import { SmartLocationFields } from "@/components/location/smart-location-fields";
import type {
  SavedCustomerLocation,
  SavedCustomerLocationKind,
  SmartLocationValue,
} from "@/lib/location/model";
import type { CustomerLocationReadResult } from "@/lib/customer/location-service";
import styles from "./member-locations-view.module.css";

const EMPTY_LOCATION: SmartLocationValue = {
  address: "",
  city: "",
  state: "",
  postalCode: "",
};

type EditorState = {
  id?: string;
  revision?: number;
  label: string;
  kind: SavedCustomerLocationKind;
  isDefault: boolean;
  location: SmartLocationValue;
};

function createEditor(location?: SavedCustomerLocation): EditorState {
  return location
    ? {
        id: location.id,
        revision: location.revision,
        label: location.label,
        kind: location.kind,
        isDefault: location.isDefault,
        location: {
          address: location.address,
          city: location.city,
          state: location.state,
          postalCode: location.postalCode,
        },
      }
    : {
        label: "",
        kind: "delivery",
        isDefault: false,
        location: EMPTY_LOCATION,
      };
}

export function MemberLocationsView({
  initial,
}: {
  initial: CustomerLocationReadResult;
}) {
  const [locations, setLocations] = useState(initial.locations);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [feedback, setFeedback] = useState(
    initial.status === "unavailable" ? initial.message : "",
  );
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setFeedback("");
    startTransition(async () => {
      const result = await saveLocationAction({
        id: editor.id,
        revision: editor.revision,
        label: editor.label,
        kind: editor.kind,
        isDefault: editor.isDefault,
        ...editor.location,
      });
      setFeedback(result.message);
      if (result.status !== "saved" || !result.location) return;
      setLocations((current) => {
        const without = current
          .filter((location) => location.id !== result.location!.id)
          .map((location) =>
            result.location!.isDefault &&
            location.kind === result.location!.kind
              ? { ...location, isDefault: false }
              : location,
          );
        return [result.location!, ...without];
      });
      setEditor(null);
    });
  }

  function remove(location: SavedCustomerLocation) {
    if (!window.confirm(`Remove ${location.label}?`)) return;
    setFeedback("");
    startTransition(async () => {
      const result = await removeLocationAction(location.id, location.revision);
      setFeedback(result.message);
      if (result.status === "removed") {
        setLocations((current) =>
          current.filter((item) => item.id !== location.id),
        );
        if (editor?.id === location.id) setEditor(null);
      }
    });
  }

  return (
    <section className={styles.page} aria-labelledby="me-locations-title">
      <header className={styles.heading}>
        <div>
          <p>Private account data</p>
          <h1 id="me-locations-title">My locations.</h1>
        </div>
        {!editor && initial.status === "ready" ? (
          <button
            type="button"
            onClick={() => setEditor(createEditor())}
            disabled={pending || locations.length >= 8}
          >
            <Plus size={17} aria-hidden="true" /> Add location
          </button>
        ) : null}
      </header>

      <div className={styles.privacyNote}>
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>Private to your account.</strong> JeloCare copies a location
          into an order only when you choose it at checkout.
        </p>
      </div>

      {editor ? (
        <form className={styles.editor} onSubmit={submit}>
          <header>
            <div>
              <p>{editor.id ? "Edit saved location" : "New saved location"}</p>
              <h2>
                {editor.id ? editor.label : "Where should this take you?"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setEditor(null)}
              aria-label="Close location editor"
            >
              <X size={19} />
            </button>
          </header>
          <div className={styles.metaFields}>
            <label>
              <span>Label</span>
              <input
                required
                minLength={2}
                maxLength={60}
                placeholder="Home or Office"
                value={editor.label}
                onChange={(event) =>
                  setEditor({ ...editor, label: event.target.value })
                }
              />
            </label>
            <label>
              <span>Use for</span>
              <select
                value={editor.kind}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    kind: event.target.value as SavedCustomerLocationKind,
                  })
                }
              >
                <option value="delivery">Delivery</option>
                <option value="billing">Billing</option>
              </select>
            </label>
          </div>
          <SmartLocationFields
            idPrefix="saved-location"
            value={editor.location}
            disabled={pending}
            onChange={(location) => setEditor({ ...editor, location })}
          />
          <label className={styles.defaultChoice}>
            <input
              type="checkbox"
              checked={editor.isDefault}
              onChange={(event) =>
                setEditor({ ...editor, isDefault: event.target.checked })
              }
            />
            <span>Use as my default {editor.kind} location</span>
          </label>
          <button
            className={styles.save}
            type="submit"
            disabled={pending || !editor.location.state}
          >
            {pending ? "Saving…" : "Save location"}
          </button>
        </form>
      ) : null}

      {initial.status === "unavailable" ? (
        <div className={styles.empty}>
          <MapPin size={24} />
          <h2>Locations are unavailable.</h2>
          <p>Checkout still accepts a manually entered address.</p>
        </div>
      ) : locations.length ? (
        <div className={styles.locations}>
          {locations.map((location) => (
            <article key={location.id} className={styles.location}>
              <header>
                <span>
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2>{location.label}</h2>
                  <p>
                    {location.kind}
                    {location.isDefault ? " · Default" : ""}
                  </p>
                </div>
              </header>
              <address>
                {location.address}
                <br />
                {location.city}, {location.state}
                {location.postalCode ? ` ${location.postalCode}` : ""}
              </address>
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => setEditor(createEditor(location))}
                  disabled={pending}
                >
                  <Pencil size={16} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(location)}
                  disabled={pending}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : !editor ? (
        <div className={styles.empty}>
          <MapPin size={24} />
          <h2>No saved locations yet.</h2>
          <p>
            Add a delivery or billing location when you want quicker checkout.
          </p>
        </div>
      ) : null}

      {feedback ? (
        <p className={styles.feedback} role="status" aria-live="polite">
          {feedback}
        </p>
      ) : null}
    </section>
  );
}
