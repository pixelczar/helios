import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://helios.run";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
  ];
}
