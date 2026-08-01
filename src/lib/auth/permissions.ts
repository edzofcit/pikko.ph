import type { merchantMemberships } from "@/db/schema";

export type MerchantRole = typeof merchantMemberships.$inferSelect.role;

export type MerchantPermission =
  | "view_dashboard"
  | "manage_bookings"
  | "verify_payments"
  | "manage_courts"
  | "manage_pricing"
  | "manage_staff"
  | "manage_billing";

const permissionsByRole: Record<MerchantRole, readonly MerchantPermission[]> = {
  owner: [
    "view_dashboard",
    "manage_bookings",
    "verify_payments",
    "manage_courts",
    "manage_pricing",
    "manage_staff",
    "manage_billing",
  ],
  site_manager: [
    "view_dashboard",
    "manage_bookings",
    "verify_payments",
    "manage_courts",
    "manage_pricing",
  ],
  booking_staff: ["view_dashboard", "manage_bookings"],
  cashier: ["view_dashboard", "manage_bookings", "verify_payments"],
  viewer: ["view_dashboard"],
};

export function permissionsForRole(role: MerchantRole) {
  return permissionsByRole[role];
}

export function roleHasPermission(
  role: MerchantRole,
  permission: MerchantPermission,
) {
  return permissionsByRole[role].includes(permission);
}

export function formatMerchantRole(role: MerchantRole) {
  return role
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
