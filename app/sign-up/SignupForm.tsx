"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthShell, authCardClass, authInputClass, authSubmitClass } from "@/components/auth/AuthShell";
import { signup } from "@/lib/auth";
import { signupSchema, type SignupSchema } from "@/lib/formValidationSchemas";
import { toProperName } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, Building2, ClipboardCheck, Eye, EyeOff, Headset, Lock, Mail, ShieldCheck, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { useActionState, useState, useTransition } from "react";

type Department = { id: string; name: string };

const highlights = [
  {
    icon: Headset,
    title: "Fast IT support",
    text: "Send tickets straight to the IT team and get notified as they progress.",
  },
  {
    icon: ClipboardCheck,
    title: "Track your accomplishments",
    text: "Your resolved tickets and completed tasks feed your monthly report.",
  },
  {
    icon: ShieldCheck,
    title: "Account approval",
    text: "New accounts are reviewed and activated by an administrator before first sign-in.",
  },
];

function FieldError({ message }: { message?: unknown }) {
  if (!message) return null;
  return <p className="text-red-600 dark:text-red-400 text-xs">{String(message)}</p>;
}

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-200";
const iconClass = "pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400";

export default function SignupForm({ departments }: { departments: Department[] }) {
  const [state, formAction] = useActionState(signup, { error: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, startSubmittingTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      departmentId: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit((data) => {
    startSubmittingTransition(() => {
      formAction({ ...data, name: toProperName(data.name) });
    });
  });

  return (
    <AuthShell
      eyebrow="Join the IT Helpdesk"
      heading="Create your account."
      description="Submit IT support tickets, build your workplan, and generate your individual accomplishment reports from one portal."
      highlights={highlights}
    >
      <Card className={authCardClass}>
        <CardHeader className="gap-1.5 px-7 pb-2 pt-7">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign up
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Fill in your details to request access.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-7 pb-7 pt-5">
          <form className="space-y-4" onSubmit={onSubmit}>
            {state?.error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {state.error}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name" className={labelClass}>
                Full name
              </Label>
              <div className="relative">
                <User className={iconClass} />
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  {...register("name")}
                  placeholder="e.g. Juan Dela Cruz"
                  className={authInputClass}
                />
              </div>
              <FieldError message={errors.name?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username" className={labelClass}>
                  Username
                </Label>
                <div className="relative">
                  <AtSign className={iconClass} />
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    {...register("username")}
                    placeholder="jdelacruz"
                    className={authInputClass}
                  />
                </div>
                <FieldError message={errors.username?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className={labelClass}>
                  Email
                </Label>
                <div className="relative">
                  <Mail className={iconClass} />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    placeholder="juan@company.com"
                    className={authInputClass}
                  />
                </div>
                <FieldError message={errors.email?.message} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className={labelClass}>Department</Label>
              <Controller
                control={control}
                name="departmentId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="relative h-11! w-full rounded-xl border-slate-200 bg-slate-50/80 pl-10 text-slate-900 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white">
                      <Building2 className={iconClass} />
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.departmentId?.message} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password" className={labelClass}>
                  Password
                </Label>
                <div className="relative">
                  <Lock className={iconClass} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("password")}
                    placeholder="Create password"
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
                <FieldError message={errors.password?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className={labelClass}>
                  Confirm password
                </Label>
                <div className="relative">
                  <Lock className={iconClass} />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                    placeholder="Re-enter password"
                    className={`${authInputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <FieldError message={errors.confirmPassword?.message} />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className={`${authSubmitClass} mt-2`}>
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating account...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Create account</span>
                </div>
              )}
            </Button>

            <div className="border-t border-slate-100 pt-5 text-center dark:border-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {"Already have an account? "}
                <Link
                  href="/sign-in"
                  className="font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-blue-100/70">
        By creating an account, you agree to follow your organization&apos;s IT policies.
      </p>
    </AuthShell>
  );
}
