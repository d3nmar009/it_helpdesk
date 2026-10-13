'use client'
import React from 'react'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { logout } from "@/lib/auth"
import { LogOut, User, User as UserIcon } from 'lucide-react'
import Link from 'next/link'

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

const PopoverAvatar = ({ name, username, role }: { name?: string | null; username?: string | null; role?: string | null }) => {
  const displayName = name || username || "User";
  const initials = getInitials(displayName);

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild className="cursor-pointer">
          <Avatar className="size-9 ring-2 ring-blue-500/30 ring-offset-2 ring-offset-white transition hover:ring-blue-500/60 dark:ring-offset-slate-900">
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
              {initials || <User className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} className="w-64 overflow-hidden p-0">
          <div className="flex items-center gap-3 bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-4 text-white">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/30">
              {initials || <User className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-blue-100">
                {username ? `@${username}` : null}
                {username && role ? " · " : null}
                {role?.replace(/_/g, " ")}
              </p>
            </div>
          </div>
          <div className="space-y-1 p-2">
            <Link href="/profile">
              <Button variant='ghost' className="w-full justify-start">
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>
            <Button
              variant='ghost'
              onClick={() => logout()}
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default PopoverAvatar
