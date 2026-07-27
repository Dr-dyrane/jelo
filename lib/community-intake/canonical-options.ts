export function communityOptionId(prefix: string, value: string) {
  return `${prefix}:${value
    .normalize('NFKD')
    .toLocaleLowerCase('en-NG')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

type CommunityConcernPurpose = {
  kind: 'concern';
  concernSlug:
    | 'acne-breakouts'
    | 'dark-spots'
    | 'oily-congested-skin'
    | 'dry-dehydrated-skin'
    | 'sensitive-barrier';
};

type CommunityContextPurpose = {
  kind: 'skin-profile' | 'area';
  concernSlug: null;
};

type CommunityPurposeDefinition = {
  id: `purpose:${string}`;
  label: string;
  aliases: readonly string[];
} & (CommunityConcernPurpose | CommunityContextPurpose);

/**
 * This is the reviewed join between the eight public intake choices and the
 * concern library. Aliases are canonical concern names only: clinical signs,
 * symptoms and unreviewed community terms must never become search aliases.
 */
export const communityPurposeRegistry = [
  {
    id: 'purpose:acne',
    label: 'Acne',
    kind: 'concern',
    concernSlug: 'acne-breakouts',
    aliases: ['Acne & breakouts'],
  },
  {
    id: 'purpose:dark-spots',
    label: 'Dark spots',
    kind: 'concern',
    concernSlug: 'dark-spots',
    aliases: ['Dark spots'],
  },
  {
    id: 'purpose:oily-skin',
    label: 'Oily skin',
    kind: 'concern',
    concernSlug: 'oily-congested-skin',
    aliases: ['Oily & congested skin'],
  },
  {
    id: 'purpose:dry-skin',
    label: 'Dry skin',
    kind: 'concern',
    concernSlug: 'dry-dehydrated-skin',
    aliases: ['Dry & dehydrated skin'],
  },
  {
    id: 'purpose:normal-skin',
    label: 'Normal skin',
    kind: 'skin-profile',
    concernSlug: null,
    aliases: [],
  },
  {
    id: 'purpose:sensitive-skin',
    label: 'Sensitive skin',
    kind: 'concern',
    concernSlug: 'sensitive-barrier',
    aliases: ['Sensitive skin & barrier'],
  },
  {
    id: 'purpose:hair',
    label: 'Hair',
    kind: 'area',
    concernSlug: null,
    aliases: [],
  },
  {
    id: 'purpose:body',
    label: 'Body',
    kind: 'area',
    concernSlug: null,
    aliases: [],
  },
] as const satisfies readonly CommunityPurposeDefinition[];

export const communityPurposeLabels = communityPurposeRegistry.map(option => option.label);

export const communityPurposeOptions = communityPurposeRegistry.map(option => ({
  id: option.id,
  label: option.label,
  aliases: [...option.aliases],
}));
