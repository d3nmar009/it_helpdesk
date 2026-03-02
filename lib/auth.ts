"use server";

import { getIronSession } from "iron-session";
import { defaultSession, SessionDataHelpdesk, sessionOptions } from "./sessionOption";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from 'bcrypt';
import { redirect } from "next/navigation";
import type { SignupSchema, UserSchema } from "./formValidationSchemas";
import { Prisma } from "@/generated/prisma/client";
import { toProperName } from "./utils";

export const getSession = async () => {
    const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
        session.isLoggedIn = defaultSession.isLoggedIn;
    }
    const plainSession = { ...session };
    return plainSession;
}
export async function login(prevState: { error: undefined | string | null },
    data: UserSchema){
        
    const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
    const formUsername = data.username
    const formPassword = data.password
    // CHECK USER IN DB
    const user = await prisma.users.findFirst({
        where: {
            username: formUsername,
        },
        include: {
            role: {
                select: { name: true },
            },
        },
    })

    if (!user) {
        return { error: "Incorrect Credentials!" }
    }
    const password = user.password;
    const isMatch = await bcrypt.compare(formPassword, password);
    console.log(isMatch)
    if (!isMatch) {
        return { error: "Incorrect Credentials!" }
    }
 
    // Check if user account is active
    if (!user.isActive) {
        return { error: "Your account is not activated yet. Please contact an administrator to activate your account." }
    }
    
    session.isLoggedIn = true;
    session.userId = user.id;
    session.username = user.username;
    session.role = user.role?.name;

    await session.save();
    // isLoading = false
    redirect("/dashboard");
    // return { error: "false" }
}

export async function signup(
    prevState: { error: undefined | string | null },
    data: SignupSchema,
) {
    const { name, username, email, password, departmentId } = data;
    const properName = toProperName(name);

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await prisma.users.create({
            data: {
                name: properName,
                username,
                email,
                password: hashedPassword,
                departmentId,
                // Force activation workflow (login() checks isActive)
                isActive: false,
            },
        });
    } catch (err) {
        // Unique constraint: username/email already exists
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return { error: "Username or email already exists." };
        }

        console.error("signup failed:", err);
        return { error: "Failed to create account. Please try again." };
    }

    redirect("/sign-in");
}
export const avoidSignIn = async () => {
    const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
    if (session.isLoggedIn) {
        redirect('/dashboard')
    }
}
export const logout = async () => {
    const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);
    session.destroy();
    redirect("/sign-in");
}
export const protectedRoute = async () => {
    const session = await getIronSession<SessionDataHelpdesk>(await cookies(), sessionOptions);

    if (!session || !session.isLoggedIn) {  // Check if session exists and if the user is logged in
        redirect("/");  // Redirect to sign-in if not logged in
    }
    return session
}
// export const restrictedRoute = async (page: string) => {

//     const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
//     if (!session || !session.isLoggedIn) {  // Check if session exists and if the user is logged in
//         redirect("/");  // Redirect to sign-in if not logged in
//     } else {
//         if (!session.allowPages?.includes(page)) {
//             redirect(`/unauthorized?route=${encodeURIComponent(page)}`);
//         }
//     }
// }

// export const signup = async (
//     prevState: { error: undefined | string },
//     formData: FormData,
// ) => {

//     const username = formData.get("username") as string;
//     let password = formData.get("password") as string;
//     const firstName = formData.get("firstName") as string;
//     const lastName = formData.get("lastName") as string;
//     // const hashtest = await bcrypt.hash("1234", 10);
//     // console.log(hashtest)
//     password = await bcrypt.hash(password, 10);
//     try {
//         const user = await prisma.users.create({
//             data: {
//                 username: username,
//                 password: password,
//                 name: firstName + " " + lastName,
//                 isActive: false,
//             },
//         })
//     } catch (error) {
//         console.log(error)
//         // Return error state instead of redirecting
//         return { error: "Failed to create user. Please try again." }
//     }
    
//     // Only redirect to sign-in if user creation was successful
//     redirect("/sign-in");

// }