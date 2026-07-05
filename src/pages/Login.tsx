import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useRole } from "@/context/RoleContext";
import { loginSchema, type LoginInput } from "@/lib/auth";
import { BrandMark } from "@/components/BrandMark";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useRole();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const redirectTo = location.state?.from && location.state.from !== "/login"
    ? location.state.from
    : "/";

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await login(values);
      toast.success("Signed in", {
        description: "Session restored for this browser.",
      });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to sign in");
    }
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-2">
          <BrandMark className="h-10 w-10 rounded-xl" />
          <div>
            <div className="font-semibold">YK Apparels</div>
            <div className="text-[11px] opacity-70 uppercase tracking-wider">Production Suite</div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-bold leading-tight max-w-md">
            Run YK Apparels production with confidence.
          </h2>
          <p className="text-sm opacity-80 max-w-md leading-relaxed">
            From yarn inward to dispatch. Plan capacity across 7 lines, track 6+ vendor partners,
            and maintain quality across every brand you serve.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-md pt-4">
            {[
              { v: "200K", l: "Units/mo capacity" },
              { v: "7+", l: "Active brands" },
              { v: "92%", l: "OTIF delivery" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-2xl font-bold font-mono-num">{s.v}</div>
                <div className="text-[11px] opacity-70 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[11px] opacity-60">
          © 2024 YK Apparels. Built for apparel production teams.
        </div>

        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <div className="font-semibold">YK Apparels</div>
          </div>

          <h1 className="text-2xl font-bold">Sign in to your factory</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Use your work email to access dashboards.
          </p>

          <Form {...form}>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs">Email</FormLabel>
                    <FormControl>
                      <Input type="email" className="h-10" placeholder="Enter email" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs">Password</FormLabel>
                      <a className="text-[11px] text-primary hover:underline" href="#">
                        Forgot?
                      </a>
                    </div>
                    <FormControl>
                      <Input type="password" className="h-10" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />

              {submitError && (
                <Alert variant="destructive" className="py-3">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-10 mt-2" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
              </Button>

              <div className="text-[11px] text-center text-muted-foreground pt-2">
                Demo users: rohit@ykapparels.in / demo1234, meena@ykapparels.in / planner123
              </div>
            </form>
          </Form>

          <div className="mt-10 pt-6 border-t border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Trusted by
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Marks &amp; Spencer</span>·<span>H&amp;M</span>·<span>Uniqlo</span>·<span>Zara</span>·<span>GAP</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
