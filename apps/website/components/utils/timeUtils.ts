export function formatDistanceToNow(timestamp: Date | number): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  // For older messages, show the actual time
  return time.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTimeUntil(timestamp: Date | string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInMs = time.getTime() - now.getTime();
  
  // If the time has passed, return "Starting now"
  if (diffInMs <= 0) {
    return 'Starting now';
  }
  
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  
  if (diffInDays > 0) {
    return `${diffInDays}d ${diffInHours % 24}h`;
  }
  
  if (diffInHours > 0) {
    return `${diffInHours}h ${diffInMinutes % 60}m`;
  }
  
  if (diffInMinutes > 0) {
    return `${diffInMinutes}m`;
  }
  
  return 'Starting soon';
}
