'use client'
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, authCardClass, authInputClass, authSubmitClass } from "@/components/auth/AuthShell";
import { avoidSignIn, login } from "@/lib/auth"
import { userSchema, UserSchema } from "@/lib/formValidationSchemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardCheck, Eye, EyeOff, ListChecks, Lock, LogIn, Ticket, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

const highlights = [
  {
    icon: Ticket,
    title: "Submit & track IT tickets",
    text: "Report hardware, software, network, and access issues and follow them until resolved.",
  },
  {
    icon: ListChecks,
    title: "Plan your workload",
    text: "Build your workplan and organize tasks by priority and schedule.",
  },
  {
    icon: ClipboardCheck,
    title: "Accomplishment reports",
    text: "Generate monthly accomplishment reports from completed tickets and tasks.",
  },
];

const LoginPage = () => {
  const [state, formAction] = useActionState(login, { error: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, startSubmittingTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserSchema>({
    resolver: zodResolver(userSchema),
  });

  const onSubmit = handleSubmit((data) => {
    startSubmittingTransition(() => {
      formAction({ ...data });
    });
  });
  useEffect(() => {
    async function avoid_SignIn() {
      await avoidSignIn()
    }
    avoid_SignIn()
  }, [])

  return (
    <AuthShell
      eyebrow="IT Support Portal"
      heading="Support. Plan. Deliver."
      description="Sign in to manage IT support tickets, organize your workplan, and generate individual accomplishment reports — all in one place."
      highlights={highlights}
    >
      <Card className={authCardClass}>
        <CardHeader className="gap-1.5 px-7 pb-2 pt-7">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Sign in to your IT Helpdesk account to continue.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-7 pb-7 pt-5">
          <form className="space-y-5" onSubmit={onSubmit}>
            {state?.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {state.error}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Username
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  {...register("username")}
                  placeholder="e.g. jdelacruz"
                  className={authInputClass}
                />
              </div>
              {errors.username?.message && (
                <p className="text-red-600 dark:text-red-400 text-xs">
                  {errors.username.message.toString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  placeholder="Enter your password"
                  className={`${authInputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password?.message && (
                <p className="text-red-600 dark:text-red-400 text-xs">
                  {errors.password.message.toString()}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} className={authSubmitClass}>
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </div>
              )}
            </Button>

            <div className="border-t border-slate-100 pt-5 text-center dark:border-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {"Don't have an account? "}
                <Link
                  href="/sign-up"
                  className="font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Create account
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-blue-100/70">
        For account activation, contact your IT administrator.
      </p>
    </AuthShell>
  )
}

export default LoginPage
