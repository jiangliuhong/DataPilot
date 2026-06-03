import AppLayout from "@/web/components/layout/app-layout";
import { menuItems } from "@/web/constants/menu-config";

export default function Home() {
  return <AppLayout menuItems={menuItems} />;
}
