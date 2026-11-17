import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import {
  LANDING_DESCRIPTION,
  LANDING_TITLE,
  OG_IMAGE_ALT,
  SITE_NAME,
} from "@/lib/share-metadata";

export const metadata: Metadata = {
  title: {
    absolute: LANDING_TITLE,
  },
  description: LANDING_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: SITE_NAME,
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    url: "/",
    // La página reemplaza el openGraph del layout. Hay que repetir la imagen.
    images: [
      {
        url: "/opengraph-image",
        type: "image/png",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
  },
};

export default function Page() {
  return <LandingPage />;
}
