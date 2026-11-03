import * as React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet.jsx';
import { ScrollArea } from '../ui/scroll-area.jsx';
import { Separator } from '../ui/separator.jsx';
import { Logo } from './Logo.jsx';
import { useApp } from '../../app/AppContext.jsx';
import { sidebarData } from './sidebar-data.js';
import { cn } from '../../lib/utils.js';

export function MobileNav() {
  const { active, navigate } = useApp();
  const [open, setOpen] = React.useState(false);
  const go = entry => {
    if (entry.moduleId) navigate(entry.moduleId, { tab: entry.tab, strategy: entry.strategy });
    else if (entry.href?.startsWith('http')) window.open(entry.href, '_blank', 'noopener');
    else if (entry.href?.startsWith('/')) window.open(entry.href, '_blank', 'noopener');
    setOpen(false);
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <ScrollArea>
          <nav className="flex flex-col gap-1">
            {sidebarData.navGroups.map(group => (
              <div key={group.title}>
                <div className="sheet-group-title">{group.title}</div>
                {group.items.map(entry => {
                  const Icon = entry.icon;
                  return (
                    <React.Fragment key={entry.label}>
                      <button
                        type="button"
                        onClick={() => go(entry)}
                        className={cn('sheet-link', entry.moduleId === active && 'active')}
                      >
                        <Icon className="size-4" />
                        {entry.label}
                      </button>
                      {entry.children?.map(child => {
                        const ChildIcon = child.icon;
                        return (
                          <button
                            type="button"
                            key={child.label}
                            onClick={() => go(child)}
                            className="sheet-link sub"
                          >
                            <ChildIcon className="size-4" />
                            {child.label}
                          </button>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}
            <Separator />
            <div>
              <div className="sheet-group-title">{sidebarData.footerGroup.title}</div>
              {sidebarData.footerGroup.items.map(entry => {
                const Icon = entry.icon;
                return (
                  <button type="button" key={entry.label} onClick={() => go(entry)} className="sheet-link">
                    <Icon className="size-4" />
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
