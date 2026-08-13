export type SmartLocationValue = {
  address: string;
  city: string;
  state: string;
  postalCode: string;
};

export type LocationSuggestion = SmartLocationValue & {
  id: string;
  label: string;
};

export type SavedCustomerLocationKind = "delivery" | "billing";

export type SavedCustomerLocation = SmartLocationValue & {
  id: string;
  label: string;
  kind: SavedCustomerLocationKind;
  isDefault: boolean;
  revision: number;
  updatedAt: string;
};
