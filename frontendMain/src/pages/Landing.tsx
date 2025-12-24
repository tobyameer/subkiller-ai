import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { NewsletterModal } from "@/components/NewsletterModal";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useAuth";
import {
  Mail,
  Search,
  Radar,
  TrendingDown,
  MessageSquare,
  Shield,
  CreditCard,
  Bot,
  ChevronRight,
  Check,
  Zap,
} from "lucide-react";
import { SpendChart } from "@/components/Charts";

const mockChartData = [
  { month: "Jul", amount: 234 },
  { month: "Aug", amount: 289 },
  { month: "Sep", amount: 245 },
  { month: "Oct", amount: 312 },
  { month: "Nov", amount: 278 },
  { month: "Dec", amount: 295 },
];

const steps = [
  {
    icon: Mail,
    title: "Connect Gmail",
    description: "Securely link your email. We only read receipts, nothing else.",
  },
  {
    icon: Search,
    title: "Scan Receipts",
    description: "Our AI finds every charge—subscriptions and one-time payments.",
  },
  {
    icon: TrendingDown,
    title: "See Your Money Leaks",
    description: "Get a clear view of where your money goes each month.",
  },
];

const features = [
  {
    icon: CreditCard,
    title: "Not Just Subs",
    description: "Track all payments, not only recurring subscriptions. Every charge matters.",
  },
  {
    icon: Bot,
    title: "AI Copilot",
    description: "Chat with AI about your spending patterns and get personalized saving tips.",
  },
  {
    icon: Shield,
    title: "Email-First, No Bank Login",
    description: "Safe and transparent. We never touch your bank account—just receipts.",
  },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Scan last 3 months",
      "Basic dashboard",
      "5 active subscriptions",
      "Email support",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    features: [
      "Full 12 months history",
      "AI Copilot unlocked",
      "Unlimited subscriptions",
      "Smart alerts",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
];

export default function Landing() {
  const { data: user, isLoading: userLoading } = useUser();
  const [showNewsletter, setShowNewsletter] = useState(false);

  useEffect(() => {
    // Only show newsletter modal for non-logged-in users on first visit
    if (userLoading) return; // Wait for auth check to complete

    // Don't show if user is logged in
    if (user) {
      setShowNewsletter(false);
      return;
    }

    // Check localStorage flags
    const dismissed = localStorage.getItem("newsletterDismissed");
    const subscribed = localStorage.getItem("newsletterSubscribed");

    // Only show if neither flag exists (first visit)
    if (!dismissed && !subscribed) {
      // Small delay to let page render first
      const timer = setTimeout(() => {
        setShowNewsletter(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, userLoading]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <NewsletterModal open={showNewsletter} onOpenChange={setShowNewsletter} />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm">
                <Radar className="w-4 h-4" />
                <span>Your AI Money Radar</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
                See every charge.{" "}
                <span className="text-primary">Kill the waste.</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg">
                SubKiller scans your email for real receipts and shows every dollar leaving your wallet. No bank login required.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/dashboard" className="gap-2">
                    <Mail className="w-5 h-5" />
                    Connect Gmail
                  </Link>
                </Button>
                <Button variant="heroOutline" size="xl" asChild>
                  <Link to="/dashboard" className="gap-2">
                    See demo dashboard
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right - Mock Dashboard */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent blur-3xl opacity-50" />
              <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl animate-float">
                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">This month</p>
                    <p className="text-xl font-bold text-foreground">$295</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Recurring</p>
                    <p className="text-xl font-bold text-primary">$127</p>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">Active subs</p>
                    <p className="text-xl font-bold text-foreground">8</p>
                  </div>
                </div>
                
                {/* Mini chart */}
                <div className="h-40 relative">
                  <SpendChart data={mockChartData} type="area" />
                  <span className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full bg-background/80 border border-border text-muted-foreground">
                    Demo data
                  </span>
                </div>
                
                {/* Scan line effect */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Three simple steps to see where your money really goes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-full h-px bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                
                <div className="relative bg-card border border-border rounded-2xl p-8 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_hsl(152_100%_50%/0.1)]">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why SubKiller */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why SubKiller is different
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We built the tool we wished existed
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-2xl p-8 transition-all duration-300 hover:border-primary/50 group"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 group-hover:shadow-[0_0_20px_hsl(152_100%_50%/0.3)] transition-shadow">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Copilot Preview */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
                <MessageSquare className="w-4 h-4" />
                <span>AI Copilot</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Ask anything about your spending
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Our AI understands your payment history and can answer questions, spot trends, and suggest ways to save.
              </p>
              <Button variant="hero" size="lg" asChild>
                <Link to="/ai-copilot">
                  <Bot className="w-5 h-5 mr-2" />
                  Try AI Copilot
                </Link>
              </Button>
            </div>

            {/* Chat preview */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
              <div className="space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-foreground">Why is my card so high this month?</p>
                  </div>
                </div>
                
                {/* AI response */}
                <div className="flex justify-start">
                  <div className="bg-secondary border border-border rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">SubKiller AI</span>
                    </div>
                    <p className="text-sm text-foreground mb-3">
                      I found 3 charges higher than usual this month:
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Spotify (yearly)</span>
                        <span className="text-primary font-medium">$99.99</span>
                      </li>
                      <li className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Adobe Creative</span>
                        <span className="text-primary font-medium">$54.99</span>
                      </li>
                      <li className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">AWS Services</span>
                        <span className="text-primary font-medium">$42.50</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, honest pricing
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-card border rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight
                    ? "border-primary shadow-[0_0_40px_hsl(152_100%_50%/0.2)]"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Popular
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button
                  variant={plan.highlight ? "hero" : "outline"}
                  className="w-full"
                  size="lg"
                  asChild
                >
                  <Link to="/dashboard">{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
