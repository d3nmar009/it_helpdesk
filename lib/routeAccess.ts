export type RoleName = string;

const ROUTE_ROLE_RULES: Record<string, RoleName[]> = {
  "/dashboard": ["ADMIN", "IT_STAFF"],
  "/ticket-management": ["ADMIN", "IT_STAFF"],
  "/ticket-asignment": ["ADMIN", "IT_STAFF"],
  "/maintenance/users": ["ADMIN"],
  "/maintenance/department": ["ADMIN"],
  "/maintenance/ticket-category": ["ADMIN"],
  "/staff-assigning": ["ADMIN", "STAFF_HEAD"],
};

export function canAccessRoute(route: string, role: RoleName | undefined | null): boolean {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const requiredRoles = ROUTE_ROLE_RULES[normalizedRoute];
  if (!requiredRoles) return true; // default allow if not listed

  const normalizedRole = (role ?? "").toUpperCase();
  return requiredRoles.includes(normalizedRole);
}


