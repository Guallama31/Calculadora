import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;

export function SheetContent({ className, children, ...props }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="sheet-overlay" />
      <Dialog.Content className={cn('sheet-content', className)} aria-describedby={undefined} {...props}>
        {children}
        <Dialog.Close className="ui-btn ui-btn-ghost ui-btn-icon" aria-label="Cerrar menú"
          style={{ position: 'absolute', top: 10, right: 10 }}><X size={16} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
export function SheetHeader({ className, ...props }) {
  return <div className={cn('sheet-header', className)} {...props} />;
}
