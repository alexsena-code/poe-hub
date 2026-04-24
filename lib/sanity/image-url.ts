import { createImageUrlBuilder } from "@sanity/image-url";
import type { ImageUrlBuilder, SanityImageSource } from "@sanity/image-url";
import { sanityPublicConfig } from "./client";

/**
 * Returns a chainable ImageUrlBuilder for a given Sanity image source.
 * Port of `imageBuilder()` from poetrade-dev/sanity/sanity-utils.ts.
 *
 * Client-side safe — uses NEXT_PUBLIC_ vars, no write token.
 *
 * Usage:
 *   imageUrlFor(post.mainImage).width(800).url()
 */
export function imageUrlFor(source: SanityImageSource): ImageUrlBuilder {
  return createImageUrlBuilder(sanityPublicConfig).image(source);
}
