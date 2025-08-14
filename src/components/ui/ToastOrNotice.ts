import { supabase } from '@/integrations/supabase/client';

export async function recordNotification(userId: string | undefined, title: string, body: string, link?: string) {
  if (!userId) return;
  // Try to insert notification - fail silently if table doesn't exist or has different schema
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({ 
        user_id: userId, 
        title, 
        body, 
        link,
        type: 'system'
      });
    // Success - notification recorded
    if (!error) return;
  } catch (err) {
    console.warn('Failed to record notification:', err);
    // Table might not exist or have different schema - fail silently
  }
}