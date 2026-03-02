'use client'
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { avoidSignIn, login } from "@/lib/auth"
import { userSchema, UserSchema } from "@/lib/formValidationSchemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Moon, Sun, Lock, User, Eye, EyeOff, Shield } from "lucide-react";
import Image from "next/image"
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";


const LoginPage = () => {
  const [state, formAction] = useActionState(login, { error: "" });
  const [isDarkMode, setIsDarkMode] = useState(true);
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

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Theme Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleDarkMode}
        className="fixed top-6 right-6 z-10 bg-white/70 dark:bg-slate-900/60 backdrop-blur border-gray-200/70 dark:border-slate-700/70 hover:bg-white dark:hover:bg-slate-900 transition-all duration-200"
      >
        {!isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Left: Branding / Helpdesk info */}
        <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-200 blur-3xl dark:bg-blue-900/30" />
            <div className="absolute top-40 -right-24 h-72 w-72 rounded-full bg-indigo-200 blur-3xl dark:bg-indigo-900/30" />
            <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-slate-200 blur-3xl dark:bg-slate-800/50" />
          </div>

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 shadow-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">
                  IT Helpdesk
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-none mt-1">
                  Workplan & Accomplishment System
                </p>
              </div>
            </div>

            <h1 className="mt-10 text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
              Support. Plan. Deliver.
            </h1>
            <p className="mt-4 text-gray-600 dark:text-gray-300 max-w-md">
              Sign in to manage IT support tickets, create your workplan, and generate individual accomplishment reports.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 max-w-md">
              <div className="rounded-2xl border border-white/50 bg-white/50 backdrop-blur p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">What you can do</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                    Create and track IT helpdesk tickets (hardware, software, network, access)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    Build your own workplan and organize tasks by priority and schedule
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-700 dark:bg-slate-300" />
                    Generate individual accomplishment reports from completed work and tickets
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-white/50 bg-white/50 backdrop-blur p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Designed for teams</p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Supervisors can monitor progress, while staff can document outputs consistently—making reporting fast and reliable.
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Image
              className="h-6 w-6"
              src="/quezelco1_Logo.png"
              alt="Quezelco1 Logo"
              width={24}
              height={24}
            />
            <span>QUEZELCO1 • IT Helpdesk • Workplan & Accomplishment</span>
          </div>
        </div>

        {/* Right: Login form */}
        <div className="flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 shadow-lg flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">
                    IT Helpdesk
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-none mt-1">
                    Workplan & Accomplishment System
                  </p>
                </div>
              </div>
            </div>

            <Card className="w-full rounded-2xl border border-gray-200/70 shadow-xl bg-white/80 backdrop-blur dark:bg-slate-900/60 dark:border-slate-700/70">
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Login to IT Helpdesk
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Access the helpdesk, create your workplan, and generate accomplishment reports.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <form className="space-y-5" onSubmit={onSubmit}>
                  {/* Error Message */}
                  {state?.error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">
                        {state.error}
                      </p>
                    </div>
                  )}

                  {/* Username Field */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Username
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        id="username"
                        type="text"
                        {...register("username")}
                        placeholder="e.g. jdelacruz"
                        className="pl-10 h-12 rounded-xl border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20"
                      />
                    </div>
                    {errors.username?.message && (
                      <p className="text-red-600 dark:text-red-400 text-xs">
                        {errors.username.message.toString()}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        {...register("password")}
                        placeholder="Enter your password"
                        className="pl-10 pr-10 h-12 rounded-xl border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500/20 dark:focus:ring-blue-400/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
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

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span>Sign In</span>
                      </div>
                    )}
                  </Button>

                  {/* Sign Up Link */}
                  <div className="text-center pt-4 border-t border-gray-100 dark:border-slate-800">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {"Don't have an account? "}
                      <Link
                        href="/sign-up"
                        className="font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                      >
                        Create account
                      </Link>
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
              For account activation, contact your IT administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage