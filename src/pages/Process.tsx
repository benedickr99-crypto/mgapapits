import { Link } from "react-router-dom";
import {
  CheckCircle,
  FileText,
  Upload,
  ClipboardCheck,
  CalendarCheck,
  Download,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: FileText,
    title: "Create Account",
    desc: "Register and log in to your trekking account to begin the booking process.",
  },
  {
    icon: ClipboardCheck,
    title: "Select Trail & Schedule",
    desc: "Choose your desired trail and pick an available trekking date.",
  },
  {
    icon: Upload,
    title: "Upload Requirements",
    desc: "Submit required documents such as valid ID, waiver, and medical certificate.",
  },
  {
    icon: CheckCircle,
    title: "Verification & Approval",
    desc: "Your documents will be reviewed by DENR staff for approval.",
  },
  {
    icon: CalendarCheck,
    title: "Confirmed Booking",
    desc: "Receive confirmation and prepare for your trekking adventure.",
  },
];

const Process = () => {
  const scrollRef = useScrollAnimation();

  return (
    <div ref={scrollRef} className="bg-gray-50 min-h-screen">

      {/* HERO */}
      <section className="bg-gradient-to-r from-green-800 to-green-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">
            Booking Process
          </h1>
          <p className="mt-4 text-white/80">
            Follow these simple steps to secure your NNNP trekking permit.
          </p>
        </div>
      </section>

      {/* STEPS */}
      <section className="animate-on-scroll max-w-7xl mx-auto px-4 py-16">
        <div className="relative space-y-8 max-w-4xl mx-auto">
          {/* Connecting line */}
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-green-200" />

          {steps.map((step, index) => (
            <div
              key={index}
              className="animate-on-scroll card-hover relative flex gap-6 items-center"
            >

              {/* ICON */}
              <div className="relative z-10 flex-shrink-0">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-green-700 text-white shadow-lg">
                  <step.icon size={20} />
                </div>
              </div>

              {/* CONTENT */}
              <div className="bg-white p-6 rounded-2xl shadow-md w-full hover:shadow-lg transition">
                <h2 className="text-xl font-semibold">
                  {index + 1}. {step.title}
                </h2>
                <p className="text-gray-600 mt-2">
                  {step.desc}
                </p>
                {step.title === "Upload Requirements" && (
                  <div className="mt-3">
                    <a
                      href="/DENR_NNNP_Trekking_Waiver.docx"
                      download="DENR_NNNP_Trekking_Waiver.docx"
                      className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                      Download Official Waiver Form (.docx)
                    </a>
                  </div>
                )}
              </div>

            </div>
          ))}

        </div>
      </section>

      {/* CTA */}
      <section className="animate-on-scroll max-w-7xl mx-auto px-4 pb-20">
        <div className="bg-green-800 text-white rounded-2xl p-10 text-center shadow-lg max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold">
            Ready to start your journey?
          </h2>
          <p className="mt-3 text-white/80">
            Begin your application and secure your trekking permit today.
          </p>

          <Link
            to="/faq"
            className="inline-block mt-6 bg-yellow-500 text-black px-6 py-3 rounded-xl font-medium hover:bg-yellow-600 transition"
          >
            Get Started
          </Link>
        </div>
      </section>

    </div>
  );
};

export default Process;