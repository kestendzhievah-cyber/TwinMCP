// Single source of truth for the site's legal identity (LCEN art. 6-III).
//
// These fields are rendered on BOTH the French "Mentions légales"
// (/legal/mentions-legales) and the English "Legal notice" (/legal/en/notice),
// so they only need to be filled once. The publisher is a Bulgarian EOOD
// (single-member limited liability company), so the registration number is an
// EIK/UIC from the Bulgarian Commercial Register — not a French SIREN.
// Replace every [ … ] placeholder with the real values before relying on the
// pages: until then, the legal notice is not juridically complete.
// `email` is already a live address.
export const EDITEUR = {
  denomination: "[à compléter : dénomination exacte de l'EOOD, ex. « TwinMCP EOOD »]",
  formeJuridique: "EOOD (ЕООД) — société unipersonnelle à responsabilité limitée de droit bulgare",
  adresse: "[à compléter : adresse du siège social en Bulgarie]",
  immatriculation: "[à compléter : n° EIK (registre du commerce bulgare)]",
  capital: "[à compléter : capital social, ex. « 2 BGN »]",
  tva: "[à compléter : n° TVA intracommunautaire BG…, ou « non assujetti à la TVA »]",
  directeurPublication: "[à compléter : prénom et nom du gérant de l'EOOD]",
  email: "hello@twinmcp.fr",
} as const;

// VPS provider running twinmcp.fr (via Dokploy). Entity per Hostinger's
// universal terms of service and the Cyprus company register (HE 301365).
// Double-check against a Hostinger invoice: EU customers are sometimes
// contracted by UAB "Hostinger", Jonavos g. 60C, 44192 Kaunas, Lituanie.
export const HEBERGEUR = {
  nom: "Hostinger International Ltd",
  adresse: "61 Lordou Vironos str., 6023 Larnaca, Chypre",
  telephone: "+370 645 03378",
} as const;
