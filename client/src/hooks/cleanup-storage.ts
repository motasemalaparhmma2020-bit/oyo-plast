// Cleanup localStorage from old guestMode flag
if (typeof window !== 'undefined') {
  // Remove legacy guestMode flag
  localStorage.removeItem('guestMode');
}
