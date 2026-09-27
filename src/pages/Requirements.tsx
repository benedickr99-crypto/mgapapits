import { Link } from "react-router-dom";
import { IdCard, HeartPulse, FileSignature, Phone, Banknote, Download } from "lucide-react";

type Requirement = {
  title: string;
  description: string;
  icon: React.ElementType;
  downloadUrl?: string;
  downloadLabel?: string;
};

export default function Requirements() {
  const requirements: Requirement[] = [
    {
      title: "Valid ID",
      description:
        "A government-issued ID such as National ID, Passport, or Driver's License.",
      icon: IdCard,
    },
    {
      title: "Medical Certificate",
      description:
        "Proof that you are physically fit to participate in trekking activities.",
      icon: HeartPulse,
    },
    {
      title: "Waiver Form",
      description:
        "A signed waiver acknowledging the risks involved in trekking. Download the official DENR waiver document below, fill it in, sign, and upload during booking.",
      icon: FileSignature,
      downloadUrl: "/DENR_NNNP_Trekking_Waiver.docx",
      downloadLabel: "Download Official Waiver Form (.docx)",
    },
    {
      title: "Emergency Contact",
      description:
        "Provide a reliable contact person in case of emergencies.",
      icon: Phone,
    },
    {
      title: "Environmental Fee",
      description:
        "Payment of ₱300 environmental/permit fee (subject to DENR guidelines).",
      icon: Banknote,
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto py-16 px-4">
        {/* HEADER */}
        <h1 className="text-4xl font-bold mb-2">Requirements</h1>
        <p className="text-gray-600 mb-8">
          Prepare the following before submitting your trekking permit application.
        </p>

        {/* LIST */}
        <div className="space-y-6">
          {requirements.map((req, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-md p-6 flex items-start gap-4"
            >
              <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-full bg-green-100 text-green-700">
                <req.icon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {index + 1}. {req.title}
                </h2>
                <p className="text-gray-600 mt-1">
                  {req.description}
                </p>
                {req.downloadUrl && (
                  <div className="mt-3">
                    <a
                      href={req.downloadUrl}
                      download="DENR_NNNP_Trekking_Waiver.docx"
                      className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold px-4 py-2 rounded-xl text-sm transition shadow-xs"
                    >
                      <Download className="w-4 h-4 text-emerald-700" />
                      {req.downloadLabel || "Download Form"}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* NOTE */}
        <div className="mt-10 p-6 bg-yellow-50 border border-yellow-200 rounded-2xl">
          <h3 className="font-semibold text-yellow-700">
            Important Reminder
          </h3>
          <p className="text-yellow-600 text-sm mt-1">
            Incomplete or invalid documents may delay your booking approval.
            Make sure all requirements are prepared before submission.
          </p>
        </div>

        {/* BUTTON */}
        <div className="mt-10 text-center">
          <Link
            to="/booking"
            className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition inline-block"
          >
            Proceed to Booking
          </Link>
        </div>
      </div>
    </div>
  );
}