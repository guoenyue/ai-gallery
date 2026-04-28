import { UserGallery } from "@/components/user-gallery";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "灵感画廊"
};

export default function GalleryPage() {
  return <UserGallery />;
}
