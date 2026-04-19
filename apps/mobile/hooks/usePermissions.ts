import { useMemo } from "react";
import type { ShareRole } from "../services/api.types";

interface PermissionFlags {
  isOwner: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageSharing: boolean;
}

/**
 * Derive permission flags from the myRole field on an Apiary or Hive.
 * When myRole is null/undefined, the user is the owner.
 */
export function useResourcePermission(myRole?: ShareRole | null): PermissionFlags {
  return useMemo(() => {
    const isOwner = !myRole || myRole === "owner";
    const isEditor = myRole === "editor";
    return {
      isOwner,
      canEdit: isOwner || isEditor,
      canDelete: isOwner,
      canManageSharing: isOwner,
    };
  }, [myRole]);
}
