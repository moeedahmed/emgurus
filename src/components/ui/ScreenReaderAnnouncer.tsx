import { useEffect, useState } from 'react';

/**
 * Screen reader announcer component that listens for custom events
 * and announces messages via aria-live region
 */
export function ScreenReaderAnnouncer() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAnnouncement = (event: CustomEvent) => {
      const { message } = event.detail;
      setMessage(message);
      
      // Clear message after a short delay to allow for new announcements
      setTimeout(() => setMessage(''), 100);
    };

    window.addEventListener('sr-announce', handleAnnouncement as EventListener);
    
    return () => {
      window.removeEventListener('sr-announce', handleAnnouncement as EventListener);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      role="status"
      aria-atomic="true"
      className="sr-only"
      data-testid="sr-announcer"
    >
      {message}
    </div>
  );
}