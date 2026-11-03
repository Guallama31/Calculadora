import { cn } from '../../lib/utils.js';
export function ScrollArea({ className, children, ...props }) {
  return (
    <div className={cn('scroll-area', className)} {...props}>
      {children}
    </div>
  );
}
