export type ProductCareSourceRole =
  | "clinical_guidance"
  | "drug_label"
  | "product_evidence"
  | "regulator_record"
  | "research_record"
  | "unclassified";

export type ProductCareSource = {
  url: string;
  hostname: string;
  role: ProductCareSourceRole;
  label: string;
};

export type ProductCareSourceProfile = {
  status: "missing" | "single_role" | "claim_scoped_pair" | "needs_review";
  sources: ProductCareSource[];
  invalidUrls: string[];
  unclassifiedUrls: string[];
  distinctHostCount: number;
  hasProductEvidence: boolean;
  hasClaimContext: boolean;
};

const productEvidenceHosts = new Set([
  "advancedclinicals.com",
  "africa.cerave.com",
  "anua.com",
  "aquarich.net",
  "aveeno.com",
  "axis-y.com",
  "balanceactiveformula.com",
  "beautyformulas.co.uk",
  "beautyofjoseon.com",
  "bentoncosmetics.com",
  "blabkorea.com",
  "cecred.com",
  "cerave.co.uk",
  "cerave.com",
  "cosrx.com",
  "danglifestyle.co",
  "dlclabs.com",
  "dove.com",
  "drteals.com",
  "elfcosmetics.com",
  "en.abib.com",
  "estelin.co.in",
  "eucerin-cewa.com",
  "evolutionofsmooth.com",
  "facefacts.com",
  "facefacts.me",
  "fentybeauty.com",
  "garnier.co.uk",
  "garnier.com.au",
  "goodmolecules.com",
  "international.danglifestyle.co",
  "keracare.com",
  "laroche-posay.co.uk",
  "laroche-posay.fr",
  "medik8.com",
  "naturium.com",
  "neutrogena.com",
  "ninelessshop.com",
  "nivea.com.ng",
  "no.loccitane.com",
  "ogxbeauty.com",
  "olay.com",
  "panoxyl.com",
  "prequelskin.com",
  "replenix.com",
  "saltair.com",
  "sheamoisture.com",
  "shiseido.co.jp",
  "simple.co.uk",
  "simpleskincare.com",
  "skinbyzaron.com",
  "somebymi.com",
  "theordinary.com",
  "tresemme.com",
  "zaroncosmetics.com",
]);

const exactHostRoles: Readonly<
  Record<string, Pick<ProductCareSource, "role" | "label">>
> = {
  "aad.org": {
    role: "clinical_guidance",
    label: "Dermatology guidance",
  },
  "accessdata.fda.gov": {
    role: "regulator_record",
    label: "FDA record",
  },
  "cochrane.org": {
    role: "research_record",
    label: "Systematic evidence",
  },
  "dailymed.nlm.nih.gov": {
    role: "drug_label",
    label: "Drug label",
  },
  "greenbook.nafdac.gov.ng": {
    role: "regulator_record",
    label: "NAFDAC record",
  },
  "nice.org.uk": {
    role: "clinical_guidance",
    label: "Clinical guidance",
  },
  "pubmed.ncbi.nlm.nih.gov": {
    role: "research_record",
    label: "Research record",
  },
  "registration.nafdac.gov.ng": {
    role: "regulator_record",
    label: "NAFDAC verification",
  },
  "who.int": {
    role: "clinical_guidance",
    label: "Public-health guidance",
  },
};

export function classifyProductCareSource(
  value: string,
): ProductCareSource | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const known =
      exactHostRoles[hostname] ??
      (hostname === "nhs.uk" || hostname.endsWith(".nhs.uk")
        ? ({
            role: "clinical_guidance",
            label: "NHS guidance",
          } as const)
        : null);

    if (known) {
      return {
        url: parsed.href,
        hostname,
        role: known.role,
        label: known.label,
      };
    }

    if (productEvidenceHosts.has(hostname)) {
      return {
        url: parsed.href,
        hostname,
        role: "product_evidence",
        label: "Product evidence",
      };
    }

    return {
      url: parsed.href,
      hostname,
      role: "unclassified",
      label: "Source pending review",
    };
  } catch {
    return null;
  }
}

export function formatProductCareSourceLabel(value: string): string {
  const source = classifyProductCareSource(value);
  return source ? `${source.label} · ${source.hostname}` : value;
}

export function buildProductCareSourceProfile(
  values: readonly string[],
): ProductCareSourceProfile {
  const sources: ProductCareSource[] = [];
  const invalidUrls: string[] = [];

  for (const value of values) {
    const source = classifyProductCareSource(value);
    if (source) sources.push(source);
    else invalidUrls.push(value);
  }

  const hasProductEvidence = sources.some(
    (source) => source.role === "product_evidence",
  );
  const hasClaimContext = sources.some(
    (source) =>
      source.role !== "product_evidence" && source.role !== "unclassified",
  );
  const unclassifiedUrls = sources
    .filter((source) => source.role === "unclassified")
    .map((source) => source.url);
  const status =
    invalidUrls.length > 0 || unclassifiedUrls.length > 0
      ? "needs_review"
      : sources.length === 0
        ? "missing"
        : hasProductEvidence && hasClaimContext
          ? "claim_scoped_pair"
          : "single_role";

  return {
    status,
    sources,
    invalidUrls,
    unclassifiedUrls,
    distinctHostCount: new Set(sources.map((source) => source.hostname)).size,
    hasProductEvidence,
    hasClaimContext,
  };
}
