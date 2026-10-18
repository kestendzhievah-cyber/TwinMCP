// Re-uses the opengraph-image renderer so we have a single source of truth
// for both <meta og:image> and Twitter cards. Both run on the Node runtime
// (the default), so no route-segment config needs re-exporting here.
export { default, alt, size, contentType } from "./opengraph-image";
