import { notFound } from "next/navigation";
import { KitDemo } from "./kit-demo";

/** Referência viva dos primitivos. Fora do ar em produção (AC-0.14). */
export default function KitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <KitDemo />;
}
