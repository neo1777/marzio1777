import { useAuth } from '../contexts/AuthContext';
import type { UserRole, AccountStatus } from '../types';

/**
 * Centralized RBAC accessor. Wraps useAuth() and exposes derived flags so the
 * call-sites stop spelling out `profile?.role === 'X'` (40+ occurrences before
 * this refactor — see CLAUDE.md tech-debt #11).
 *
 * Read-only: never mutates the auth context. Component code should always go
 * through this hook for role/status checks; AuthContext is for the underlying
 * user/profile/loading state.
 */
export function useRBAC() {
  const { user, profile, loading } = useAuth();
  const role: UserRole | undefined = profile?.role;
  const accountStatus: AccountStatus | undefined = profile?.accountStatus;

  const isRoot = role === 'Root';
  const isAdmin = role === 'Admin';
  const isGuest = role === 'Guest';
  const isAdminOrRoot = isAdmin || isRoot;
  const isApproved = accountStatus === 'approved';
  const isPending = accountStatus === 'pending';

  return {
    user,
    profile,
    loading,
    role,
    accountStatus,
    isRoot,
    isAdmin,
    isGuest,
    isAdminOrRoot,
    isApproved,
    isPending,
  };
}
