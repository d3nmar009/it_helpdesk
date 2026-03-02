'use client'

import { useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { AlertTriangle } from 'lucide-react'
import { Suspense } from 'react'

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const route = searchParams.get('route') || searchParams.get('page') || 'Unknown';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg mx-auto shadow-xl border-0">
        <CardHeader className="flex flex-col items-center gap-2">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-2" />
          <CardTitle className="text-3xl font-bold text-center text-gray-900 dark:text-white">
            Unauthorized Access
          </CardTitle>
          <CardDescription className="text-center text-lg text-gray-600 dark:text-gray-300">
            The route you tried to access is not authorized:
          </CardDescription>
          <div className="text-center text-base font-mono text-red-600 break-all bg-red-50 dark:bg-gray-800 rounded p-2 w-full">
            {route}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-700 dark:text-gray-200 text-base mb-4">
            You do not have permission to access this page.<br />
            <span className="font-semibold text-red-600">Please contact your administrator to request access.</span>
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-2 rounded">
            <Link href="/dashboard">
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UnauthorizedContent />
    </Suspense>
  )
}

