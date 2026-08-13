export const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NigeriaState = (typeof NIGERIA_STATES)[number];

const CITIES_BY_STATE: Partial<Record<NigeriaState, readonly string[]>> = {
  Abia: ["Aba", "Umuahia"],
  Anambra: ["Awka", "Nnewi", "Onitsha"],
  Delta: ["Asaba", "Sapele", "Warri"],
  Edo: ["Benin City", "Ekpoma"],
  Enugu: ["Enugu", "Nsukka"],
  "Federal Capital Territory": ["Abuja", "Gwagwalada", "Kubwa", "Lugbe"],
  Kaduna: ["Kaduna", "Kafanchan", "Zaria"],
  Kano: ["Kano"],
  Kwara: ["Ilorin", "Offa"],
  Lagos: ["Ajah", "Badagry", "Epe", "Ikeja", "Ikorodu", "Lagos", "Lekki"],
  Ogun: ["Abeokuta", "Ifo", "Ota", "Sagamu"],
  Oyo: ["Ibadan", "Ogbomoso"],
  Plateau: ["Jos"],
  Rivers: ["Bonny", "Port Harcourt"],
};

export function nigeriaCitySuggestions(state: string): readonly string[] {
  return CITIES_BY_STATE[state as NigeriaState] ?? [];
}

export function isNigeriaState(value: string): value is NigeriaState {
  return (NIGERIA_STATES as readonly string[]).includes(value);
}

export function normalizeNigeriaState(value: string): NigeriaState | null {
  const normalized = value.trim().replace(/\s+State$/i, "");
  if (
    /^(?:FCT|Federal Capital Territory|Abuja Federal Capital Territory)$/i.test(
      normalized,
    )
  ) {
    return "Federal Capital Territory";
  }
  return (
    NIGERIA_STATES.find(
      (state) =>
        state.toLocaleLowerCase("en") === normalized.toLocaleLowerCase("en"),
    ) ?? null
  );
}
