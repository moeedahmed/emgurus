let lastMessage = '';
let lastMessageTime = 0;

/**
 * Announce a message to screen readers via CustomEvent
 * Debounces duplicate messages within 300ms to avoid spam
 */
export function announce(message: string): void {
  const now = Date.now();
  
  // Debounce duplicate messages within 300ms
  if (message === lastMessage && now - lastMessageTime < 300) {
    return;
  }
  
  lastMessage = message;
  lastMessageTime = now;
  
  // Dispatch custom event for the screen reader announcer to pick up
  window.dispatchEvent(new CustomEvent('sr-announce', {
    detail: { message }
  }));
}