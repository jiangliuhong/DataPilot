import Providers from "@/web/components/layout/providers";
import "@/app/globals.css";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
