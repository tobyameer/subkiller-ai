import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAppStore } from "../store/useAppStore";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Free",
    monthly: "$0",
    yearly: "$0",
    description: "Start scanning with no commitment.",
    features: ["Scan up to 5 subscriptions", "Email reminders", "1 device"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    monthly: "$12",
    yearly: "$108",
    description: "For power users who want alerts and AI.",
    features: [
      "Unlimited scans",
      "Renewal alerts",
      "Basic AI recommendations",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Premium",
    monthly: "$29",
    yearly: "$276",
    description: "Automation for teams & families.",
    features: [
      "Everything in Pro",
      "Advanced AI recommendations",
      "Auto-generated cancel emails",
      "Multi-user / family plan",
    ],
    cta: "Go Premium",
    highlight: false,
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const startCheckout = useAppStore((state) => state.startCheckout);
  const user = useAppStore((state) => state.user);
  const navigate = useNavigate();

  return (
    <div className="space-y-10">
      <div className="text-center space-y-4">
        <Badge className="bg-sky-500/15 text-sky-200">Pricing</Badge>
        <h1 className="text-4xl font-semibold text-slate-50">Pick the plan that fits</h1>
        <p className="text-slate-400">
          Transparent pricing with an AI agent that keeps you informed and in control.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/70 p-1">
          <Button
            size="sm"
            variant={billing === "monthly" ? "default" : "ghost"}
            className="rounded-full px-4"
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </Button>
          <Button
            size="sm"
            variant={billing === "yearly" ? "default" : "ghost"}
            className="rounded-full px-4"
            onClick={() => setBilling("yearly")}
          >
            Yearly
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative border ${plan.highlight ? "border-sky-400 shadow-lg shadow-sky-900/40" : "border-slate-800/70"} bg-slate-900/70`}
          >
            {plan.highlight && (
              <Badge className="absolute -right-2 -top-2 bg-sky-500 text-slate-950">Most Popular</Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-100">
                {plan.name}
                {plan.highlight && <Sparkles className="h-4 w-4 text-sky-200" />}
              </CardTitle>
              <p className="text-sm text-slate-400">{plan.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-semibold text-slate-50">
                {billing === "monthly" ? plan.monthly : plan.yearly}
                <span className="text-base font-normal text-slate-400">
                  {billing === "monthly" ? "/mo" : "/yr"}
                </span>
              </div>
              <ul className="space-y-2 text-sm text-slate-200">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={() => {
                  if (plan.name.toLowerCase() === "free") {
                    navigate(user ? "/dashboard" : "/auth/register");
                  } else {
                    startCheckout(plan.name.toLowerCase() as "pro" | "premium");
                  }
                }}
              >
                {plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
