'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';

interface PermissionGuardProps {
  /**
   * Permission code(s) required to show children
   * Can be a single permission or array of permissions
   */
  permission: string | string[];

  /**
   * How to handle multiple permissions:
   * - 'all': User must have ALL permissions (default)
   * - 'any': User must have at least ONE permission
   */
  mode?: 'all' | 'any';

  /**
   * Content to show if permission check passes
   */
  children: ReactNode;

  /**
   * Content to show if permission check fails
   * Defaults to null (nothing shown)
   */
  fallback?: ReactNode;

  /**
   * If true, show a loading skeleton while permissions are loading
   */
  showLoading?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions
 *
 * @example
 * // Single permission
 * <PermissionGuard permission="view.users">
 *   <UsersList />
 * </PermissionGuard>
 *
 * @example
 * // Multiple permissions (ALL required)
 * <PermissionGuard permission={["manage.users", "manage.users.delete"]}>
 *   <DeleteButton />
 * </PermissionGuard>
 *
 * @example
 * // Multiple permissions (ANY required)
 * <PermissionGuard permission={["view.users", "manage.users"]} mode="any">
 *   <UsersSection />
 * </PermissionGuard>
 *
 * @example
 * // With fallback
 * <PermissionGuard permission="view.recordings" fallback={<AccessDenied />}>
 *   <RecordingsList />
 * </PermissionGuard>
 */
export function PermissionGuard({
  permission,
  mode = 'all',
  children,
  fallback = null,
  showLoading = false,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  // Handle loading state
  if (isLoading && showLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      </div>
    );
  }

  // Convert single permission to array
  const permissions = Array.isArray(permission) ? permission : [permission];

  // Check permissions based on mode
  let hasAccess = false;
  if (mode === 'any') {
    hasAccess = hasAnyPermission(...permissions);
  } else {
    hasAccess = hasAllPermissions(...permissions);
  }

  // Render based on access
  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version of PermissionGuard
 *
 * @example
 * const ProtectedComponent = withPermission(MyComponent, 'manage.users');
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string | string[],
  mode: 'all' | 'any' = 'all'
) {
  return function PermissionWrappedComponent(props: P) {
    return (
      <PermissionGuard permission={permission} mode={mode}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}

/**
 * Hook-based permission check for use in event handlers or effects
 *
 * @example
 * const canDelete = useCanAccess('manage.users.delete');
 * onClick={() => canDelete && handleDelete()}
 */
export function useCanAccess(permission: string | string[], mode: 'all' | 'any' = 'all'): boolean {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];

  if (mode === 'any') {
    return hasAnyPermission(...permissions);
  }
  return hasAllPermissions(...permissions);
}
