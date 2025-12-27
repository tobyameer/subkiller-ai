import { useState, useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuthMutations } from "@/hooks/useAuth";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { countries } from "@/lib/countries";

type Step = 1 | 2 | 3 | 4;

export default function AuthWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");
  const { register } = useAuthMutations();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    country: "",
    marketingOptIn: false,
  });

  const progress = useMemo(() => (step / 4) * 100, [step]);

  const errors = useMemo(() => {
    const err: Record<string, string> = {};
    if (step >= 1) {
      if (touched.email && !/\S+@\S+\.\S+/.test(form.email))
        err.email = "Enter a valid email";
      if (touched.password && form.password.length < 8)
        err.password = "Minimum 8 characters";
    }
    if (step >= 2) {
      if (touched.firstName && !form.firstName.trim())
        err.firstName = "First name is required";
      if (touched.lastName && !form.lastName.trim())
        err.lastName = "Last name is required";
    }
    return err;
  }, [form, step, touched]);

  const canNext = () => {
    if (step === 1) return !errors.email && !errors.password;
    if (step === 2) return !errors.firstName && !errors.lastName;
    return true;
  };

  const handleNext = () => {
    // Mark all fields on current step as touched
    if (step === 1) {
      setTouched((t) => ({ ...t, email: true, password: true }));
    } else if (step === 2) {
      setTouched((t) => ({ ...t, firstName: true, lastName: true }));
    }

    if (!canNext()) {
      toast.error("Please complete required fields.");
      return;
    }
    setStep((s) => Math.min(4, s + 1) as Step);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (step < 4) handleNext();
    }
  };

  const handleBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setLoading(true);
    try {
      await register.mutateAsync({
        email: form.email,
        password: form.password,
        name: `${form.firstName} ${form.lastName}`.trim(),
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        country: form.country || undefined,
        marketingOptIn: form.marketingOptIn,
      });
      toast.success("Account created successfully");
      // Auto-login: user is already logged in via cookies from register endpoint
      navigate(next || "/dashboard");
    } catch (err: any) {
      // Better error handling with specific messages
      let errorMessage = "Failed to create account";

      if (err?.isNetworkError || err?.status === 0) {
        // Network/connection error
        errorMessage =
          err.message ||
          "Cannot connect to backend server. Please check your connection.";
      } else if (err?.status === 400) {
        // Validation error from server
        errorMessage =
          err.data?.message ||
          err.message ||
          "Invalid registration data. Please check your inputs.";
      } else if (err?.status === 409) {
        errorMessage = "Email already registered. Please sign in instead.";
      } else if (err?.status === 401) {
        errorMessage = "Authentication failed. Please try again.";
      } else if (err?.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (err?.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <div className="space-y-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="you@example.com"
              onKeyDown={handleKeyDown}
              className="w-full"
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email}</p>
            )}
          </div>
          <div>
            <Label htmlFor="password">Password (min 8 chars)</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              placeholder="********"
              onKeyDown={handleKeyDown}
              className="w-full"
            />
            {errors.password && (
              <p className="text-xs text-destructive mt-1">{errors.password}</p>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div className="space-y-5">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
              onKeyDown={handleKeyDown}
              className="w-full"
            />
            {errors.firstName && (
              <p className="text-xs text-destructive mt-1">
                {errors.firstName}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
              onKeyDown={handleKeyDown}
              className="w-full"
            />
            {errors.lastName && (
              <p className="text-xs text-destructive mt-1">{errors.lastName}</p>
            )}
          </div>
        </div>
      );
    }
    if (step === 3) {
      return (
        <div className="space-y-5">
          <div>
            <Label>Gender</Label>
            <RadioGroup
              value={form.gender}
              onValueChange={(v) => setForm({ ...form, gender: v })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female">Female</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male">Male</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">Other</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="dob">Date of birth (optional)</Label>
            <Input
              id="dob"
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <Label>Country (optional)</Label>
            <Select
              value={form.country}
              onValueChange={(v) => setForm({ ...form, country: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {countries.map((country) => (
                  <SelectItem key={country.code} value={country.name}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="marketing"
              type="checkbox"
              className="h-4 w-4"
              checked={form.marketingOptIn}
              onChange={(e) =>
                setForm({ ...form, marketingOptIn: e.target.checked })
              }
            />
            <Label
              htmlFor="marketing"
              className="text-sm font-normal cursor-pointer"
            >
              Send me weekly deals and product updates (optional)
            </Label>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Email</span>
          <span className="text-foreground">{form.email}</span>
        </div>
        <div className="flex justify-between">
          <span>Name</span>
          <span className="text-foreground">
            {`${form.firstName} ${form.lastName}`.trim()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Gender</span>
          <span className="text-foreground">{form.gender || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>DOB</span>
          <span className="text-foreground">{form.dob || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>Country</span>
          <span className="text-foreground">{form.country || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span>Marketing</span>
          <span className="text-foreground">
            {form.marketingOptIn ? "Yes" : "No"}
          </span>
        </div>
      </div>
    );
  };

  const stepTitles = [
    "",
    "Create your account",
    "Tell us about yourself",
    "Additional information",
    "Review your information",
  ];

  const stepDescriptions = [
    "",
    "Start by creating your account credentials",
    "We'd like to know a bit more about you",
    "Help us personalize your experience",
    "Please review your information before submitting",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">
          <Card className="shadow-xl border-border/60">
            <CardHeader>
              <div className="space-y-2">
                <CardTitle className="text-2xl">{stepTitles[step]}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {stepDescriptions[step]}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Progress value={progress} className="h-1 flex-1" />
                <span className="text-xs text-muted-foreground">
                  Step {step} of 4
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">{renderStep()}</CardContent>
            <CardFooter className="flex justify-between">
              {step > 1 ? (
                <Button variant="ghost" onClick={handleBack} disabled={loading}>
                  Back
                </Button>
              ) : (
                <div /> // Spacer to keep Next button on the right
              )}
              {step < 4 ? (
                <Button onClick={handleNext} disabled={!canNext() || loading}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              )}
            </CardFooter>
          </Card>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              privacy policy
            </Link>
            .
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
