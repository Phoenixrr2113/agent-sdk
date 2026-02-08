'use client';

import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  MessageSquare,
  Target,
  RotateCw,
  Monitor,
  KeyRound,
  Activity,
  Settings,
  Plus,
} from 'lucide-react';

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  const navigate = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <kbd className="ml-auto text-xs text-muted-foreground">G D</kbd>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/chat')}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Chat</span>
            <kbd className="ml-auto text-xs text-muted-foreground">G C</kbd>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/missions')}>
            <Target className="mr-2 h-4 w-4" />
            <span>Missions</span>
            <kbd className="ml-auto text-xs text-muted-foreground">G M</kbd>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/automations')}>
            <RotateCw className="mr-2 h-4 w-4" />
            <span>Automations</span>
            <kbd className="ml-auto text-xs text-muted-foreground">G A</kbd>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/devices')}>
            <Monitor className="mr-2 h-4 w-4" />
            <span>Devices</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/vault')}>
            <KeyRound className="mr-2 h-4 w-4" />
            <span>Vault</span>
            <kbd className="ml-auto text-xs text-muted-foreground">G V</kbd>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/activity')}>
            <Activity className="mr-2 h-4 w-4" />
            <span>Activity</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <kbd className="ml-auto text-xs text-muted-foreground">G S</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => navigate('/dashboard/missions/new')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Mission</span>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/automations/new')}>
            <Plus className="mr-2 h-4 w-4" />
            <span>New Automation</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
