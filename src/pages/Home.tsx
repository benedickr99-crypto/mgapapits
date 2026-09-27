import { Link } from "react-router-dom";
import heroImg from "../assets/Mandalagan_1.jpg";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export default function Home() {
  const scrollRef = useScrollAnimation();
  const { user, profile, refreshProfile } = useAuth();

  useEffect(() => {
    const email = user?.email?.toLowerCase() || "";
    if (email === "benedickluiser@gmail.com" && profile && profile.role !== "admin") {
      supabase.from("profiles").update({ role: "admin" }).eq("id", user!.id).then(() => {
        refreshProfile();
      });
    }
  }, [user, profile?.role, refreshProfile]);

  return (
    <div ref={scrollRef} className="bg-gray-50 text-gray-800">
      {/* HERO SECTION */}
      <section
        className="relative w-full min-h-[80vh] flex items-center justify-center text-center bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${heroImg})`,
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60"></div>

        {/* Content */}
        <div className="relative z-10 text-white px-6">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Explore Nature.
            <br />
            Book Your Adventure.
          </h1>

          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Seamless trekking permit booking system for hikers and adventurers
            in Northern Negros Natural Park.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/booking"
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-xl font-semibold transition"
            >
              Start Booking
            </Link>

            <Link
              to="/trails"
              className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-semibold transition"
            >
              View Trails
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="animate-on-scroll py-16 px-4 max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-10">
          Why Use Our System?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="animate-on-scroll stagger-1 card-hover bg-white p-6 rounded-2xl shadow-md h-full flex flex-col">
            <h3 className="text-xl font-semibold mb-2">Easy Booking</h3>
            <p className="text-gray-600 flex-grow">Reserve your trekking slot in just a few clicks.</p>
          </div>

          <div className="animate-on-scroll stagger-2 card-hover bg-white p-6 rounded-2xl shadow-md h-full flex flex-col">
            <h3 className="text-xl font-semibold mb-2">
              Real-time Availability
            </h3>
            <p className="text-gray-600 flex-grow">See available dates and avoid overbooking issues.</p>
          </div>

          <div className="animate-on-scroll stagger-3 card-hover bg-white p-6 rounded-2xl shadow-md h-full flex flex-col">
            <h3 className="text-xl font-semibold mb-2">Secure System</h3>
            <p className="text-gray-600 flex-grow">Powered by modern authentication and cloud database.</p>
          </div>
        </div>
      </section>

      {/* TRAILS */}
      <section className="animate-on-scroll py-16 bg-green-50 px-4">
        <h2 className="text-2xl font-semibold text-center mb-10">Popular Trails</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {[
            {
              name: "Kumalisikis Trail",
              desc: "A beginner-friendly trail with gradual elevation and scenic forest views. Suitable for first-time trekkers looking for a light to moderate challenge.",
              img: "/images/trails/kumalisikis.jpg",
            },
            {
              name: "Mt. Mandalagan (Patag)",
              desc: "A moderately challenging trail featuring diverse terrain, including forests and sulfur vents. Ideal for trekkers with some hiking experience.",
              img: "/images/trails/mt-mandalagan.jpg",
            },
            {
              name: "Mt. Marapara",
              desc: "A difficult trail with steep ascents and rugged paths. Recommended for experienced trekkers seeking a physically demanding adventure.",
              img: "/images/trails/mt-marapara.jpg",
            },
            {
              name: "Mt. Silay",
              desc: "A challenging trail with long trekking hours, river crossings, and dense vegetation. Best suited for well-prepared hikers.",
              img: "/images/trails/mt-silay.jpg",
            },
          ].map((trail, index) => (
            <div
              key={index}
              className="animate-on-scroll card-hover bg-white rounded-2xl shadow-md overflow-hidden h-full flex flex-col"
            >
              <img src={trail.img} className="h-40 w-full object-cover" alt={trail.name} />
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="font-semibold text-lg text-gray-900 leading-tight mb-2">{trail.name}</h3>
                <p className="text-xs text-gray-600 flex-grow leading-relaxed">
                  {trail.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="animate-on-scroll py-20 text-center bg-green-700 text-white px-4">
        <h2 className="text-3xl font-bold mb-4">
          Ready for your next adventure?
        </h2>
        <p className="mb-6">
          Book your trekking permit today and explore nature safely.
        </p>

        <Link
          to="/booking"
          className="bg-white text-green-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
        >
          Book Now
        </Link>
      </section>
    </div>
  );
}
