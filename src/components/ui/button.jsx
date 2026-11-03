import * as React from 'react';
import { cn } from '../../lib/utils.js';

export const Button = React.forwardRef(function Button(
  { className, variant = 'ghost', size = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('ui-btn', `ui-btn-${variant}`, size !== 'default' && `ui-btn-${size}`, className)}
      {...props}
    />
  );
});
