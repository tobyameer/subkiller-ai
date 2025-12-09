import type { ComponentType, SVGProps } from "react";
import {
  ArrowRight,
  Brain,
  CalendarHeart,
  CheckCircle2,
  HeartPulse,
  MessageSquare,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";

const conditions = [
  {
    title: "Depression & Mood Disorders",
    desc: "Support for low mood, bipolar spectrum, and emotional regulation.",
  },
  {
    title: "Anxiety & Panic",
    desc: "Evidence-based care for generalized anxiety, panic, and health anxiety.",
  },
  {
    title: "OCD",
    desc: "Assessment and treatment to reduce intrusive thoughts and compulsions.",
  },
  {
    title: "ADHD & Attention",
    desc: "Evaluation of attention, organization, and impulsivity in adults and adolescents.",
  },
  {
    title: "Epilepsy-Related Symptoms",
    desc: "Integrated care for mood, cognition, and behavioral changes with seizures.",
  },
  {
    title: "Dementia & Cognition",
    desc: "Support for memory loss, confusion, and behavioral changes in neurodegenerative illness.",
  },
  {
    title: "Sleep Disorders",
    desc: "Insomnia, circadian disruptions, and their impact on mood and attention.",
  },
  {
    title: "Headache & Chronic Pain",
    desc: "Managing the psychiatric impact of chronic pain and migraine.",
  },
];

const steps = [
  {
    title: "Comprehensive Assessment",
    desc: "Review medical history, current concerns, and goals together.",
  },
  {
    title: "Personalized Plan",
    desc: "Combine medical, psychological, and lifestyle approaches tailored to you.",
  },
  {
    title: "Ongoing Support",
    desc: "Regular follow-up, adjustments, and collaboration with your care team.",
  },
];

const faq = [
  {
    q: "What is neuropsychiatry?",
    a: "It integrates neurology and psychiatry to understand and treat conditions that affect both mind and brain.",
  },
  {
    q: "Do I need a referral?",
    a: "Referrals help, but self-referrals are welcome. We’ll guide you on what to bring.",
  },
  {
    q: "Do you offer online appointments?",
    a: "Yes, secure telehealth appointments are available alongside in-person visits.",
  },
  {
    q: "What should I bring to my first visit?",
    a: "Medication list, past reports, and any recent imaging or lab results are helpful.",
  },
  {
    q: "Can you coordinate with my neurologist or therapist?",
    a: "Absolutely—we collaborate with your existing clinicians to align your care.",
  },
];

const testimonials = [
  {
    quote:
      "I finally felt heard. The plan was clear, and my anxiety is manageable for the first time in years.",
    name: "M.A., 28",
  },
  {
    quote:
      "Thoughtful, thorough, and calm. My son’s ADHD care has been life-changing.",
    name: "S.R., Parent",
  },
  {
    quote:
      "The balance of medical and psychological support was exactly what I needed.",
    name: "L.K., 42",
  },
];

export default function LandingPage() {
  const doctorName = "Dr. Full Name";
  const clinicName = "City Neuropsychiatry Clinic";
  const location = "City / Hospital Name";

  return (
    <div className="scroll-smooth bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-emerald-300">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">{doctorName}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Consultant Neuropsychiatrist
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            {[
              { href: "#about", label: "About" },
              { href: "#conditions", label: "Conditions" },
              { href: "#approach", label: "Approach" },
              { href: "#testimonials", label: "Testimonials" },
              { href: "#faq", label: "FAQ" },
              { href: "#contact", label: "Contact" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-emerald-200"
              >
                {item.label}
              </a>
            ))}
            <Button
              size="sm"
              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              asChild
            >
              <a href="#contact">Book Appointment</a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-20 px-4 py-12 md:py-16">
        {/* Hero */}
        <section id="hero" className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <Badge className="bg-emerald-500/15 text-emerald-200">
              Warm, evidence-based care
            </Badge>
            <h1 className="text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
              Specialized Neuropsychiatric Care for Mind and Brain
            </h1>
            <p className="text-lg text-slate-300">
              Evidence-based assessment and treatment for mood, anxiety,
              attention, and neurological conditions—all in a calm,
              collaborative setting.
            </p>
            <ul className="space-y-2 text-slate-300">
              {[
                "Personalized treatment plans",
                "Integrated medical and psychological care",
                "Confidential, judgment-free environment",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                asChild
              >
                <a href="#contact">Book an Appointment</a>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="border-emerald-400/40 text-emerald-100 hover:bg-slate-900"
                asChild
              >
                <a href="#contact">Call the Clinic</a>
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <span>
                Private, compassionate, and science-led care in {location}.
              </span>
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="relative h-full w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl shadow-emerald-900/20">
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="flex h-full flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">{clinicName}</p>
                  <h3 className="text-2xl font-semibold text-slate-50">
                    Calm, clinical space
                  </h3>
                  <p className="text-sm text-slate-300">
                    In-person and telehealth consultations designed for comfort,
                    privacy, and thorough discussion.
                  </p>
                </div>
                <div className="grid gap-3">
                  <InfoPill
                    icon={HeartPulse}
                    title="Holistic care"
                    desc="Mind, brain, body, and environment considered together."
                  />
                  <InfoPill
                    icon={CalendarHeart}
                    title="Timely follow-up"
                    desc="Regular check-ins to adjust your plan as you progress."
                  />
                  <InfoPill
                    icon={MessageSquare}
                    title="Clear communication"
                    desc="Plain language, shared decisions, and next steps."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section
          id="about"
          className="grid gap-8 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-8 md:grid-cols-[2fr,1fr]"
        >
          <div className="space-y-4">
            <Badge className="bg-sky-500/20 text-sky-100">
              About the doctor
            </Badge>
            <h2 className="text-3xl font-semibold text-slate-50">
              Meet {doctorName}
            </h2>
            <p className="text-slate-300">
              MD, PhD, Board-certified Neuropsychiatrist with over 12 years of
              experience. Consultant at {clinicName}, providing integrated care
              for complex neurological and psychiatric conditions.
            </p>
            <ul className="grid gap-2 text-slate-300 md:grid-cols-2">
              <li className="flex items-start gap-2">
                <Sparkles className="mt-1 h-4 w-4 text-emerald-300" /> Fields:
                mood, anxiety, ADHD, epilepsy-related psychiatry, cognition
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="mt-1 h-4 w-4 text-emerald-300" />{" "}
                Languages: English, [Add languages]
              </li>
            </ul>
          </div>
          <div className="flex items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-300">
              Photo
            </div>
          </div>
        </section>

        {/* Conditions */}
        <section id="conditions" className="space-y-6">
          <div className="flex flex-col gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-100">
              Conditions
            </Badge>
            <h2 className="text-3xl font-semibold text-slate-50">
              Conditions I Help With
            </h2>
            <p className="text-slate-300">
              Clear, collaborative plans for adults and parents supporting their
              loved ones.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {conditions.map((condition) => (
              <Card
                key={condition.title}
                className="border-slate-800/70 bg-slate-900/70 transition hover:border-emerald-400/40"
              >
                <CardContent className="space-y-2 p-5">
                  <h3 className="text-lg font-semibold text-slate-100">
                    {condition.title}
                  </h3>
                  <p className="text-sm text-slate-300">{condition.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Approach */}
        <section id="approach" className="grid gap-6 md:grid-cols-[1.4fr,1fr]">
          <div className="space-y-4">
            <Badge className="bg-sky-500/20 text-sky-100">
              Care philosophy
            </Badge>
            <h2 className="text-3xl font-semibold text-slate-50">
              My Approach to Care
            </h2>
            <p className="text-slate-300">
              I combine neuroscience, psychiatry, and psychology to understand
              how brain and mind interact. Every plan is tailored to your goals,
              values, and daily life.
            </p>
            <p className="text-slate-300">
              We make decisions together, balancing medication, therapy,
              lifestyle changes, and coordination with your existing clinicians.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {steps.map((step, idx) => (
                <Card
                  key={step.title}
                  className="border-slate-800/70 bg-slate-900/70"
                >
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      Step {idx + 1}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-50">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-400">{step.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-6">
            <h3 className="text-xl font-semibold text-slate-50">
              Appointments & Services
            </h3>
            <p className="text-slate-300">
              In-person and online consultations (45–60 minutes). Bring previous
              reports, medication lists, and any recent imaging or labs.
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <ArrowRight className="mt-1 h-4 w-4 text-emerald-300" /> 1.
                Contact the clinic
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="mt-1 h-4 w-4 text-emerald-300" /> 2.
                Schedule a convenient time
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="mt-1 h-4 w-4 text-emerald-300" /> 3.
                Begin your treatment plan
              </li>
            </ul>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-emerald-100">
              Fees and insurance details available on request. We respond within
              24 hours on working days.
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="space-y-6">
          <div className="flex flex-col gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-100">
              What patients say
            </Badge>
            <h2 className="text-3xl font-semibold text-slate-50">
              Trusted, Calm, and Clear
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <Card
                key={t.name}
                className="border-slate-800/70 bg-slate-900/70"
              >
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm text-slate-200">“{t.quote}”</p>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {t.name}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="space-y-6">
          <div className="flex flex-col gap-2">
            <Badge className="bg-sky-500/20 text-sky-100">FAQ</Badge>
            <h2 className="text-3xl font-semibold text-slate-50">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-800/70 bg-slate-900/70 p-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-slate-100">
                  {item.q}
                  <span className="text-slate-400 transition group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <p className="pt-2 text-sm text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section
          id="contact"
          className="grid gap-8 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-8 md:grid-cols-[1.1fr,0.9fr]"
        >
          <div className="space-y-4">
            <Badge className="bg-emerald-500/20 text-emerald-100">
              Book an Appointment
            </Badge>
            <h2 className="text-3xl font-semibold text-slate-50">
              Your first step towards better mental and brain health.
            </h2>
            <p className="text-slate-300">
              Share a few details and we’ll reach out within 24 hours on working
              days.
            </p>
            <form className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name" placeholder="Your full name" />
                <Field
                  label="Email"
                  placeholder="you@example.com"
                  type="email"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Phone" placeholder="+1 (___) ___-____" />
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">
                    Preferred appointment type
                  </label>
                  <select className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none">
                    <option>In-person</option>
                    <option>Online</option>
                    <option>No preference</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Message / Reason for visit
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
                  rows={4}
                  placeholder="Share your main concerns or questions..."
                />
              </div>
              <Button className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                Submit inquiry
              </Button>
            </form>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-800/70 bg-slate-950/80 p-6">
            <h3 className="text-xl font-semibold text-slate-50">
              Clinic Details
            </h3>
            <ul className="space-y-3 text-sm text-slate-200">
              <ContactRow
                icon={Phone}
                title="Phone"
                value="+1 (555) 123-4567"
              />
              <ContactRow
                icon={MessageSquare}
                title="WhatsApp"
                value="Start chat"
                link="#"
              />
              <ContactRow
                icon={MailIcon}
                title="Email"
                value="clinic@example.com"
              />
              <ContactRow
                icon={MapPinIcon}
                title="Address"
                value="123 Clinic Street, City, Country"
              />
            </ul>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
              Map placeholder
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-100">
              We aim to respond within 24 hours on working days. If urgent,
              please call the clinic directly.
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/70 bg-slate-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {doctorName}. All rights reserved.
          </p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-emerald-200">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-emerald-200">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function InfoPill({
  icon: Icon,
  title,
  desc,
}: {
  icon: ComponentType<any>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-200">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-slate-300">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
      />
    </div>
  );
}

function ContactRow({
  icon: Icon,
  title,
  value,
  link,
}: {
  icon: ComponentType<any>;
  title: string;
  value: string;
  link?: string;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-emerald-200">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p className="text-sm text-slate-100">{value}</p>
      </div>
    </div>
  );
  if (link) {
    return (
      <a href={link} className="block transition hover:text-emerald-200">
        {content}
      </a>
    );
  }
  return content;
}

function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <path d="M4 6.5 12 12l8-5.5" />
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </svg>
  );
}

function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      {...props}
    >
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}
