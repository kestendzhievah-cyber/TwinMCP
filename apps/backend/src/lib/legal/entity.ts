// Single source of truth for the site's legal identity (LCEN art. 6-III).
//
// These fields are rendered on BOTH the French "Mentions légales"
// (/legal/mentions-legales) and the English "Legal notice" (/legal/en/notice),
// so they only need to be filled once. Replace every [ … ] placeholder with the
// real values before relying on the pages: until then, the legal notice is not
// juridically complete. `email` is already a live address.
export const EDITEUR = {
  denomination: "[à compléter : nom / raison sociale de l'éditeur]",
  formeJuridique: "[à compléter : ex. entrepreneur individuel, SASU, SAS…]",
  adresse: "[à compléter : adresse du siège / du domicile professionnel]",
  siren: "[à compléter : n° SIREN / SIRET]",
  tva: "[à compléter : n° de TVA intracommunautaire, le cas échéant]",
  directeurPublication: "[à compléter : nom du directeur de la publication]",
  email: "hello@twinmcp.fr",
} as const;

export const HEBERGEUR = {
  nom: "[à compléter : nom / raison sociale de l'hébergeur]",
  adresse: "[à compléter : adresse de l'hébergeur]",
  telephone: "[à compléter : téléphone de l'hébergeur]",
} as const;
