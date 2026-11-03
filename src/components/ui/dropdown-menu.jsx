import * as React from 'react';
import * as Primitive from '@radix-ui/react-dropdown-menu';
import { cn } from '../../lib/utils.js';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuSeparator = ({ className }) => (
  <Primitive.Separator className={cn('dropdown-separator', className)} />
);
export const DropdownMenuLabel = ({ className, ...props }) => (
  <Primitive.Label className={cn('dropdown-label', className)} {...props} />
);

export const DropdownMenuContent = React.forwardRef(function DropdownMenuContent(
  { className, align = 'start', sideOffset = 6, ...props },
  ref,
) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn('dropdown-content', className)}
        {...props}
      />
    </Primitive.Portal>
  );
});

export const DropdownMenuItem = React.forwardRef(function DropdownMenuItem({ className, ...props }, ref) {
  return <Primitive.Item ref={ref} className={cn('dropdown-item', className)} {...props} />;
});
