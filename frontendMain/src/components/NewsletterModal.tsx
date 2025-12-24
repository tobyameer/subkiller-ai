import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface NewsletterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewsletterModal({ open, onOpenChange }: NewsletterModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const validateEmail = (email: string) => {
    const emailRegex = /\S+@\S+\.\S+/;
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubscribe = async () => {
    if (!validateEmail(email)) {
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/newsletter/subscribe", { email });
      localStorage.setItem("newsletterSubscribed", "true");
      toast.success("Thanks for subscribing!");
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage =
        err?.message || "Failed to subscribe. Please try again.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("newsletterDismissed", "true");
    onOpenChange(false);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) {
      setEmailError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Get weekly savings tips</DialogTitle>
          <DialogDescription className="text-base">
            One email per week. Cancel anytime.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="newsletter-email">Email</Label>
            <Input
              id="newsletter-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleSubscribe();
                }
              }}
              disabled={loading}
              className={emailError ? "border-destructive" : ""}
            />
            {emailError && (
              <p className="text-xs text-destructive">{emailError}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={handleDismiss}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              No thanks
            </Button>
            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Subscribing..." : "Subscribe"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

