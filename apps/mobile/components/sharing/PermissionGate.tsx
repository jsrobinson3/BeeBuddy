import type { ReactNode } from "react";
import { useResourcePermission } from "../../hooks/usePermissions";
import type { ShareRole } from "../../services/api.types";

type PermissionKey = "canEdit" | "canDelete" | "canManageSharing" | "isOwner";

interface PermissionGateProps {
  myRole?: ShareRole | null;
  require: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render children based on the user's permission level.
 * Usage: <PermissionGate myRole={apiary.myRole} require="canEdit">...</PermissionGate>
 */
export function PermissionGate({ myRole, require: perm, children, fallback }: PermissionGateProps) {
  const permissions = useResourcePermission(myRole);
  if (!permissions[perm]) return fallback ?? null;
  return <>{children}</>;
}
