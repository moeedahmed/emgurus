import React from 'react';
import { useRoles } from '@/hooks/useRoles';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Shield } from 'lucide-react';

interface RoleGateProps {
  roles: Array<'admin' | 'guru' | 'user'>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

const RoleGate: React.FC<RoleGateProps> = ({ roles, children, fallback, className }) => {
  const { user, loading: authLoading } = useAuth();
  const { roles: userRoles, isLoading: rolesLoading } = useRoles();

  if (authLoading || rolesLoading) {
    return null; // Don't show anything while checking roles
  }

  if (!user) {
    return null; // Handle auth requirement at a higher level
  }

  const hasRequiredRole = userRoles.some(role => roles.includes(role));

  if (!hasRequiredRole) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className={`p-4 text-center ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="font-medium mb-1">Access Restricted</p>
            <p className="text-sm text-muted-foreground">
              This action requires {roles.length === 1 ? `${roles[0]} role` : `one of: ${roles.join(', ')}`}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
};

export default RoleGate;