"use client";

import { useState } from "react";
import type { Deal } from "./types";

interface DealImageCarouselProps {
  deal: Deal;
}

/**
 * Image carousel for a deal card. Handles both single image_url and the
 * multi-image image_urls array returned by newer scraper versions.
 */
export function DealImageCarousel({ deal }: DealImageCarouselProps) {
  const [idx, setIdx] = useState(0);
  const images =
    deal.image_urls && deal.image_urls.length > 0
      ? deal.image_urls
      : deal.image_url
        ? [deal.image_url]
        : [];

  if (images.length === 0) return null;

  const total = images.length;

  return (
    <div className="relative aspect-[4/3] bg-muted/20 overflow-hidden group">
      <img
        src={images[idx]}
        alt={deal.title}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {total > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + total) % total);
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            &#8249;
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % total);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            &#8250;
          </button>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {idx + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
}
