import type { AdaptiveValue } from './schema';

export type AdaptiveSelectionMode = 'single' | 'multiple';

export function applyAdaptiveSelection(
  current: AdaptiveValue[],
  next: AdaptiveValue,
  mode: AdaptiveSelectionMode,
  editingId: string | null,
) {
  if (editingId) {
    const withoutEdited = current.filter(item => item.id !== editingId);
    if (mode === 'single') return [next];
    return withoutEdited.some(item => item.id === next.id)
      ? withoutEdited
      : [...withoutEdited, next];
  }

  if (mode === 'single') return [next];
  return current.some(item => item.id === next.id)
    ? current.filter(item => item.id !== next.id)
    : [...current, next];
}

export function removeAdaptiveSelection(current: AdaptiveValue[], id: string) {
  return current.filter(item => item.id !== id);
}
