import type { Metadata } from "next";
import { Today } from "@/components/routine/today";

export const metadata: Metadata = { title: "Hoje" };

export default function HojePage() {
  return <Today />;
}
