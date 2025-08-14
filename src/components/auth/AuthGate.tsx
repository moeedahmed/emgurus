import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AuthGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

const AuthGate: React.FC<AuthGateProps> = ({ children, fallback, className }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return null; // Don't show anything while checking auth
  }

  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className={`p-4 text-center ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <LogIn className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="font-medium mb-1">Sign in to continue</p>
            <p className="text-sm text-muted-foreground mb-3">
              This action requires authentication
            </p>
          </div>
          <Button 
            size="sm" 
            onClick={() => navigate('/auth')}
            className="w-full max-w-xs"
          >
            Sign In
          </Button>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
};

export default AuthGate;