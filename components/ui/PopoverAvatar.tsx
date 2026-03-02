'use client'
import React, { useEffect, useState } from 'react'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logout } from "@/lib/auth"
import { LogOut, User, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { getAvatarUrl } from '@/lib/avatarUtils'

interface UserData {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  avatar?: string;
}

const PopoverAvatar = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setUserData(data.user);
        } else {
          console.error('Failed to fetch user data');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const getInitials = (firstname: string, lastname: string) => {
    return `${firstname?.charAt(0) || ''}${lastname?.charAt(0) || ''}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild className="cursor-pointer">
          <Avatar className="w-9 h-9 border-2 border-gray-200">
            <AvatarImage 
              src={getAvatarUrl(userData?.avatar)} 
              alt={userData?.username || 'User'} 
            />
            <AvatarFallback className="text-sm font-semibold">
              {userData ? getInitials(userData.firstname, userData.lastname) : <User className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent className="w-50 ml-[-100px] p-3">
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {userData?.firstname} {userData?.lastname}
            </div>
            <div className="text-xs text-gray-500">
              {userData?.username}
            </div>
            <div className="space-y-1">
              <Link href="/profile">
                <Button variant='ghost' className="w-full justify-start">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Profile
                </Button>
              </Link>
              <Button variant='ghost' onClick={() => logout()} className="w-full justify-start">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default PopoverAvatar