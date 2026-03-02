import { SessionOptions } from "iron-session";


export interface SessionDataHelpdesk {
  userId?: string;
  username?:string;
  isLoggedIn:boolean
  role?:string
  isAutologout?:boolean
}

export const defaultSession:SessionDataHelpdesk = {
  isLoggedIn:false
}

export const sessionOptions: SessionOptions ={
  password: process.env.SECRET_KEY!,
  cookieName: "helpdesk-session",
  cookieOptions:{
    httpOnly:true,
    // secure: process.env.NODE_ENV === "production",
    secure: false,
    // sameSite: "None",
    maxAge: 60 * 60 * 8, 
  }
}