import { useState } from "react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FAQItem = {
  question: string;
  answer: string;
  category: string;
};

const faqData: FAQItem[] = [
  {
    question: "How do I book a trek?",
    answer:
      "Go to the booking page, select your trail, upload requirements, and confirm your schedule.",
    category: "Booking",
  },
  {
    question: "How early should I book?",
    answer: "You must book at least 2 weeks before your trek.",
    category: "Booking",
  },
  {
    question: "Is a guide required?",
    answer:
      "Yes. A 1:5 guide-to-trekker ratio is required for safety.",
    category: "Safety",
  },
  {
    question: "What documents are required?",
    answer:
      "Valid ID, waiver, medical certificate, and orientation proof.",
    category: "Requirements",
  },
  {
    question: "Can I cancel or reschedule?",
    answer:
      "Yes, subject to approval and availability.",
    category: "Booking",
  },
];

const categories = ["All", "Booking", "Requirements", "Safety"];

const FAQ = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const scrollRef = useScrollAnimation();

  const filteredFAQ = faqData.filter((faq) => {
    return activeCategory === "All" || faq.category === activeCategory;
  });

  return (
    <div ref={scrollRef} className="bg-gray-50 min-h-screen">

      {/* HERO */}
      <section className="bg-gradient-to-r from-green-800 to-green-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-white/80">
            Find answers about booking, requirements, and trekking guidelines.
          </p>
        </div>
      </section>

      {/* CATEGORY FILTER */}
      <section className="max-w-7xl mx-auto px-4 py-6 flex gap-3 flex-wrap justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm transition ${
              activeCategory === cat
                ? "bg-green-700 text-white"
                : "bg-white border hover:bg-gray-100"
            }`}
          >
            {cat}
          </button>
        ))}
      </section>

      {/* FAQ LIST */}
      <section className="animate-on-scroll max-w-7xl mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {filteredFAQ.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 px-2 sm:px-6 data-[state=open]:shadow-md transition-all border-b-0"
              >
                <AccordionTrigger className="hover:no-underline py-6 text-left text-lg font-semibold text-gray-800">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 pb-6 text-sm sm:text-base leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

    </div>
  );
};

export default FAQ;