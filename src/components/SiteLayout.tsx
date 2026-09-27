import { Outlet } from "react-router-dom";
import SiteHeader from "./SiteHeader";

export default function SiteLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}