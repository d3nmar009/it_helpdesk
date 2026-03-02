import { prisma } from "@/lib/prisma";
import SignupForm from "./SignupForm";

export default async function SignUpPage() {
  const departments = await prisma.departments.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <SignupForm departments={departments} />;
}




