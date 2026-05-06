// Re-uses the opengraph-image renderer so we have a single source of truth
// for both <meta og:image> and Twitter cards.
export {
  default,
  runtime,
  alt,
  size,
  contentType,
} from "./opengraph-image";
