import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/dropdown-menu.jsx';
import { cn } from '../../lib/utils.js';
import { useApp } from '../../app/AppContext.jsx';

export function NavDropdown({ group }) {
  const { active, navigate } = useApp();
  const isActive = group.items.some(i => i.moduleId === active);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('gap-1', isActive && 'text-primary')}>
          {group.title}<ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {group.items.map(entry => {
          const Icon = entry.icon;
          return (
            <React.Fragment key={entry.label}>
              <DropdownMenuItem asChild className={cn(entry.moduleId === active && 'active')}>
                <button type="button" onClick={() => navigate(entry.moduleId)}>
                  <Icon className="size-4" />{entry.label}
                </button>
              </DropdownMenuItem>
              {entry.children?.map(child => {
                const ChildIcon = child.icon;
                return (
                  <DropdownMenuItem asChild key={child.label} className="sub">
                    <button type="button" onClick={() => navigate(child.moduleId, {
                      tab: child.tab, strategy: child.strategy,
                    })}>
                      <ChildIcon className="size-4" />{child.label}
                    </button>
                  </DropdownMenuItem>
                );
              })}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
