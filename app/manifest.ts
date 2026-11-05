import type { MetadataRoute } from "next";

/** Makes the portal installable: on a phone's home screen it opens full-screen with the crest as its icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bharath Dass School",
    short_name: "Bharath Dass",
    description: "Bharath Dass Matriculation Higher Secondary School – staff portal",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e8e4dc",
    theme_color: "#7a1d21",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
