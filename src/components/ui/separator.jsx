import { cn } from '../../lib/utils.js';
export function Separator({ className, ...props }) {
  return <hr className={cn('separator', className)} {...props} />;
}
