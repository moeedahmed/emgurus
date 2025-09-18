import React from 'react';
import { Shield, Lock, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useRoles } from '@/hooks/useRoles';
import { requestDataExport } from '@/lib/security';
import { toast } from 'sonner';

export const SecurityBanner: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin } = useRoles();

  const handleDataExport = async () => {
    const success = await requestDataExport();
    if (success) {
      toast.success('Your data export will be downloaded shortly');
    }
  };

  if (!user) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">Security & Privacy</h3>
              <p className="text-xs text-muted-foreground">
                Your data is protected with enterprise-grade security
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Encrypted
            </Badge>
            
            {isAdmin && (
              <Badge variant="outline" className="gap-1">
                <Eye className="h-3 w-3" />
                Admin
              </Badge>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDataExport}
              className="h-8 text-xs"
            >
              Export Data
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityBanner;