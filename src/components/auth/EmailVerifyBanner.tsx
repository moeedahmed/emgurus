import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, X, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailVerifyBannerProps {
  className?: string;
}

const EmailVerifyBanner: React.FC<EmailVerifyBannerProps> = ({ className }) => {
  const { user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Don't show if user is verified, not authenticated, or banner was dismissed
  if (!user || user.email_confirmed_at || isDismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (!user?.email) return;

    try {
      setIsResending(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      toast.success('Verification email sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className={`border-warning/20 bg-warning/5 ${className}`}>
      <div className="p-3 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-warning shrink-0" />
        <div className="flex-1 text-sm">
          <span className="font-medium">Verify your email</span> to enable publishing & comments
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResendVerification}
            disabled={isResending}
            className="text-warning hover:text-warning h-auto py-1 px-2"
          >
            <Mail className="w-3 h-3 mr-1" />
            {isResending ? 'Sending...' : 'Resend'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="h-auto py-1 px-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default EmailVerifyBanner;