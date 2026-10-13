import { z } from "zod";
export const userSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(3).max(20),
});
export type UserSchema = z.infer<typeof userSchema>;

export const signupSchema = z
  .object({
    name: z.string().min(2, { message: "Name is required" }).max(80),
    username: z
      .string()
      .min(3, { message: "Username must be at least 3 characters" })
      .max(20),
    email: z.string().email({ message: "Please enter a valid email address" }),
    departmentId: z.string().min(1, { message: "Department is required" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .max(72),
    confirmPassword: z.string().min(8, { message: "Please confirm your password" }).max(72),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupSchema = z.infer<typeof signupSchema>;

export const ticketPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const ticketStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
]);

export const ticketCreateSchema = z.object({
  title: z.string().min(3, { message: "Title is required" }).max(120),
  description: z.string().min(10, { message: "Description is required" }).max(5000),
  categoryId: z.string().uuid({ message: "Category is required" }),
  priority: ticketPrioritySchema,
  createdById: z.string().uuid().optional(),
  // Optional override for privileged roles (ADMIN/IT_STAFF). Expect an ISO string.
  createdAt: z.string().optional(),
});
export type TicketCreateSchema = z.infer<typeof ticketCreateSchema>;

export const ticketUpdateSchema = ticketCreateSchema.extend({
  status: ticketStatusSchema,
});
export type TicketUpdateSchema = z.infer<typeof ticketUpdateSchema>;

export const ticketTriageSchema = z.object({
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  assignedToId: z.string().uuid().nullable().optional(),
  // Optional override for approving timestamp (ISO string). Only applied server-side for status=APPROVED.
  approvedAt: z.string().optional(),
});
export type TicketTriageSchema = z.infer<typeof ticketTriageSchema>;

export const userAdminUpdateSchema = z.object({
  roleId: z.string().uuid({ message: "Role is required" }),
  isActive: z.boolean(),
});
export type UserAdminUpdateSchema = z.infer<typeof userAdminUpdateSchema>;

// Max 20 because the sign-in form (userSchema) rejects longer passwords.
export const userPasswordResetSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .max(20, { message: "Password must be at most 20 characters" }),
    confirmPassword: z.string().min(1, { message: "Please confirm the password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type UserPasswordResetSchema = z.infer<typeof userPasswordResetSchema>;

export const departmentSchema = z.object({
  name: z.string().min(2, { message: "Department name is required" }).max(80),
});
export type DepartmentSchema = z.infer<typeof departmentSchema>;

export const ticketCategorySchema = z.object({
  name: z.string().min(2, { message: "Category name is required" }).max(80),
});
export type TicketCategorySchema = z.infer<typeof ticketCategorySchema>;

export const dbuserSchema = z.object({
  id: z.coerce.number().optional(),
  tellerCode: z.string().optional(),
  tellerNo: z.coerce.number({ message: "Teller No. must be number between 0 - 10" }).gte(0).lte(99).optional(),
  towncode: z.string().min(2).optional(),
});

export type DbUserSchema = z.infer<typeof dbuserSchema>;

export const signatoriesSchema = z.object({
  id: z.coerce.number(),
  asignatory1: z.string().optional(),
  designation1: z.string().optional(),
  asignatory2: z.string().optional(),
  designation2: z.string().optional(),
  asignatory3: z.string().optional(),
  designation3: z.string().optional(),
});

export type SignatoriesSchema = z.infer<typeof signatoriesSchema>;
const nonBillTransactionschema = z.object({
  id: z.number(),           // Subject ID
  description: z.string()   // Description of the subject
});
export const nonbillTransactionName = z.object({
  id: z.coerce.number(),
  name: z.string().min(1, { message: "Name is required!" }),
  nonBillList: z.array(nonBillTransactionschema).min(1, "At least one account is required")
});

export type NonbillTransactionName = z.infer<typeof nonbillTransactionName>;

export const empbillMasterSchema = z.object({
  id: z.coerce.number().optional(),
  account_number: z.string().min(1, { message: "Account number is required!" }),
  emp_name: z.string().min(1, { message: "Employee name is required!" }),
  dept: z.string().min(1, { message: "Department is required!" }),
  status: z.string().min(1, { message: "Status is required!" }),
});

export type EmpbillMasterSchema = z.infer<typeof empbillMasterSchema>;

export const profileSchema = z.object({
  id: z.coerce.number(),
  firstname: z.string().min(1, { message: "First name is required!" }).max(50, { message: "First name must be less than 50 characters" }),
  lastname: z.string().min(1, { message: "Last name is required!" }).max(50, { message: "Last name must be less than 50 characters" }),
  avatar: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email address" }).optional().or(z.literal("")),
});

export type ProfileSchema = z.infer<typeof profileSchema>;

