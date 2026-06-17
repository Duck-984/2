import { Navigate } from 'react-router-dom';
import { getCurrentAdmin, AdminRole } from '../lib/auth';

interface Props {
  children: React.ReactNode;
  requiredRole?: AdminRole;
}

const ROLE_RANK: Record<AdminRole, number> = { seller: 1, manager: 2, admin: 3 };

export const AdminRoute = ({ children, requiredRole }: Props) => {
  const admin = getCurrentAdmin();

  if (!admin) {
    return <Navigate to="/admin" replace />;
  }

  if (requiredRole && ROLE_RANK[admin.role] < ROLE_RANK[requiredRole]) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};
