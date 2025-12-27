import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check, Zap, Sparkles, Lock, CreditCard, Bot } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthMutations, useUser } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isPro } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    description: "Core tracking with Gmail scans",
    price: "$0",
    period: "/month",
    features: ["Gmail receipts scanning", "Basic dashboard & stats", "Scan limit: 1 per day"],
    lockedFeatures: ["AI Copilot (Pro only)", "Add card (Pro only)"],
    cta: "Get started",
    ctaLink: "/auth",
    highlight: false,
  },
  {
    name: "Pro",
    description: "For serious money trackers",
    price: "$9",
    period: "/month",
    features: [
      "Unlimited Gmail scans",
      "AI Copilot",
      "Link your card for higher accuracy (powered by secure bank connection)",
      "Email + card matching",
      "12 months history scan",
      "Smarter recurring-charge detection",
    ],
    limitations: [],
    cta: "Upgrade to Pro",
    ctaLink: "/dashboard",
    highlight: true,
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { data: user } = useUser();
  const { upgradePlan } = useAuthMutations();

  const handleUpgrade = async () => {
    try {
      await upgradePlan.mutateAsync();
      toast.success("Upgraded to Pro");
    } catch (err: any) {
      toast.error(err?.message || "Upgrade failed");
    }
  };

  const handleAddCard = (planName: string) => {
    if (planName === "Free") {
      navigate("/pricing");
      toast.info("Upgrade to Pro to add your card");
    } else {
      // Pro users - this would open the card linking flow
      toast.info("Card linking coming soon");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Simple, honest pricing</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Start free, upgrade when ready
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              No hidden fees. Cancel anytime. Your data stays yours.
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-card border rounded-2xl p-8 transition-all duration-300 ${
                  plan.highlight
                    ? "border-primary shadow-[0_0_60px_hsl(152_100%_50%/0.15)] scale-105"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-full flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Most popular
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h2>
                  <p className="text-muted-foreground">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-lg">{plan.period}</span>
                </div>

                <Button
                  variant={plan.highlight ? "hero" : "outline"}
                  size="lg"
                  className="w-full mb-6"
                  onClick={() => {
                    if (plan.name === "Pro") {
                      if (isPro(user)) {
                        toast.info("You're already on Pro.");
                        return;
                      }
                      handleUpgrade();
                    } else {
                      window.location.href = "/auth";
                    }
                  }}
                >
                  {plan.name === "Pro" ? "Upgrade to Pro" : "Get started"}
                </Button>

                {plan.name === "Free" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-6"
                    onClick={() => handleAddCard("Free")}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Add card
                  </Button>
                )}

                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">What's included:</p>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.lockedFeatures && plan.lockedFeatures.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">Pro features:</p>
                    <ul className="space-y-2">
                      {plan.lockedFeatures.map((feature) => (
                        <li key={feature} className="text-sm text-muted-foreground flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {plan.limitations && plan.limitations.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-3">Limitations:</p>
                    <ul className="space-y-2">
                      {plan.limitations.map((limitation) => (
                        <li key={limitation} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* FAQ teaser */}
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Have questions? We've got answers.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground">
                Can I cancel anytime? <span className="text-primary">Yes</span>
              </span>
              <span className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground">
                Is my data safe? <span className="text-primary">Absolutely</span>
              </span>
              <span className="px-4 py-2 rounded-full bg-secondary text-secondary-foreground">
                Do you sell my data? <span className="text-primary">Never</span>
              </span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
