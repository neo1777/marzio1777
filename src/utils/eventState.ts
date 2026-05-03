export function validStatusTransition(oldStatus: string, newStatus: string): boolean {
  if (oldStatus === newStatus) return true;
  
  if (oldStatus === 'draft') return ['scheduled', 'aborted'].includes(newStatus);
  if (oldStatus === 'scheduled') return ['lobby', 'active', 'aborted'].includes(newStatus);
  if (oldStatus === 'lobby') return ['active', 'aborted'].includes(newStatus);
  if (oldStatus === 'active') return ['completed', 'aborted'].includes(newStatus);
  
  return false;
}
