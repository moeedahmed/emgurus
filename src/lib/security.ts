import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  API_CALLS: 60, // requests per minute
  AUTH_ATTEMPTS: 5, // attempts per hour
  SEARCH_QUERIES: 30, // searches per minute
  FILE_UPLOADS: 10, // uploads per minute
} as const;

/**
 * Check if an action is rate limited
 */
export async function checkRateLimit(
  endpoint: string, 
  maxRequestsPerMinute: number = RATE_LIMITS.API_CALLS
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('security-rate-limit', {
      body: { endpoint, maxRequestsPerMinute }
    });

    if (error) {
      console.error('Rate limit check failed:', error);
      // Allow request if rate limit check fails (fail open)
      return true;
    }

    if (!data.allowed) {
      toast.error('Rate limit exceeded. Please wait before trying again.');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Rate limit error:', error);
    // Allow request if there's an error (fail open)
    return true;
  }
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Security headers for API requests
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
} as const;

/**
 * Log security events for audit trail
 */
export async function logSecurityEvent(
  eventType: string,
  details: Record<string, any>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('security_audit_log')
      .insert({
        table_name: 'security_events',
        operation: eventType,
        new_data: details,
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent
      });

    if (error) {
      console.error('Failed to log security event:', error);
    }
  } catch (error) {
    console.error('Security logging error:', error);
  }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP(): Promise<string> {
  try {
    // This is a fallback - in production you'd want to use headers from your CDN/proxy
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

/**
 * Secure data export for GDPR compliance
 */
export async function requestDataExport(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('export_user_data', {
      target_user_id: (await supabase.auth.getUser()).data.user?.id
    });

    if (error) {
      console.error('Data export failed:', error);
      toast.error('Failed to export data. Please try again.');
      return false;
    }

    // Create and download JSON file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Data export completed successfully');
    return true;
  } catch (error) {
    console.error('Data export error:', error);
    toast.error('Failed to export data');
    return false;
  }
}

/**
 * Content Security Policy configuration
 */
export const CSP_DIRECTIVES = {
  'default-src': "'self'",
  'script-src': "'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src': "'self' https://fonts.gstatic.com",
  'img-src': "'self' data: https: blob:",
  'connect-src': "'self' https://*.supabase.co wss://*.supabase.co",
  'frame-ancestors': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'"
} as const;