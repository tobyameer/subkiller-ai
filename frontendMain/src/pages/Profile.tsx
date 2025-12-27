import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUser, useAuthMutations } from "@/hooks/useAuth";

export default function Profile() {
  const { data: user } = useUser();
  const { updateProfile } = useAuthMutations();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dob: "",
    country: "",
    marketingOptIn: false,
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        gender: user.gender || "",
        dob: user.dob ? user.dob.substring(0, 10) : "",
        country: user.country || "",
        marketingOptIn: Boolean(user.marketingOptIn),
      });
    }
  }, [user]);

  const onSubmit = async () => {
    try {
      await updateProfile.mutateAsync(form);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err?.message || "Update failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>First name</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Gender</Label>
                  <Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
                </div>
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Country</Label>
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input
                    id="marketing"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.marketingOptIn}
                    onChange={(e) => setForm({ ...form, marketingOptIn: e.target.checked })}
                  />
                  <Label htmlFor="marketing">Receive product updates</Label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button onClick={onSubmit} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </Card>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Account deletion coming soon.</CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
