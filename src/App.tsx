import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/login";

// ⚡ ROUTE CODE-SPLITTING: Heavy pages loaded on demand
const Booking = lazy(() => import("./pages/Book"));
const MyBookings = lazy(() => import("./pages/MyBookings"));
const Admin = lazy(() => import("./pages/Admin"));
const Trails = lazy(() => import("./pages/Trails"));
const Requirements = lazy(() => import("./pages/Requirements"));
const Process = lazy(() => import("./pages/Process"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Announcements = lazy(() => import("./pages/Announcements"));
const MapNavigation = lazy(() => import("./pages/MapNavigation"));
const Profile = lazy(() => import("./pages/Profile"));
const GuideDashboard = lazy(() => import("./pages/GuideDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

import ProtectedRoute from "./components/ProtectedRoute";
import RequireAdmin from "./components/RequireAdmin";
import RequireGuide from "./components/RequireGuide";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import "./index.css";
import { Toaster } from "@/components/ui/sonner";

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* 🔝 NAVBAR */}
      <SiteHeader />

      {/* 📄 MAIN CONTENT */}
      <main className="flex-1">
        <Suspense fallback={<PageFallback />}>
          <Routes>

            {/* PUBLIC ROUTES */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/trails" element={<Trails />} />
            <Route path="/navigation" element={<MapNavigation />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/requirements" element={<Requirements />} />
            <Route path="/process" element={<Process />} />
            <Route path="/faq" element={<FAQ />} />

            {/* 🔐 PROTECTED USER ROUTES */}
            <Route
              path="/booking"
              element={
                <ProtectedRoute>
                  <Booking />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* 🛠 ADMIN ROUTE */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <Admin />
                </RequireAdmin>
              }
            />

            {/* 🧭 GUIDE ROUTE */}
            <Route
              path="/guide"
              element={
                <RequireGuide>
                  <GuideDashboard />
                </RequireGuide>
              }
            />

            {/* ❌ 404 */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </Suspense>
      </main>

      {/* 🔻 FOOTER */}
      <SiteFooter />

      {/* 🔔 TOASTS */}
      <Toaster position="top-center" richColors />
    </div>
  );
}