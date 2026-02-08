'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useMissions } from './use-missions';
import { useApprovals } from './use-approvals';

/**
 * Hook to show toast notifications for mission status changes and new approvals.
 * Tracks previous state to detect changes and avoid duplicate notifications.
 */
export function useStatusNotifications() {
  const { missions } = useMissions();
  const { pendingCount } = useApprovals();
  
  const prevMissionsRef = useRef<Map<string, string>>(new Map());
  const prevApprovalCountRef = useRef<number>(0);
  const initializedRef = useRef(false);

  // Watch for mission status changes
  useEffect(() => {
    if (!missions || missions.length === 0) return;
    
    // Skip initial load to avoid showing toasts for existing states
    if (!initializedRef.current) {
      missions.forEach((mission) => {
        prevMissionsRef.current.set(mission.id, mission.status);
      });
      initializedRef.current = true;
      return;
    }
    
    missions.forEach((mission) => {
      const prevStatus = prevMissionsRef.current.get(mission.id);
      if (prevStatus && prevStatus !== mission.status) {
        // Status changed
        if (mission.status === 'completed') {
          toast.success('Mission completed', {
            description: mission.goal?.slice(0, 50),
          });
        } else if (mission.status === 'failed') {
          toast.error('Mission failed', {
            description: mission.error || mission.goal?.slice(0, 50),
          });
        } else if (mission.status === 'awaiting_approval') {
          toast.info('Approval required', {
            description: 'A mission step needs your approval',
            action: {
              label: 'View',
              onClick: () => {
                window.location.href = `/dashboard/missions/${mission.id}`;
              },
            },
          });
        }
      }
      prevMissionsRef.current.set(mission.id, mission.status);
    });
  }, [missions]);

  // Watch for new approvals
  useEffect(() => {
    // Skip initial load
    if (prevApprovalCountRef.current === 0 && pendingCount > 0) {
      prevApprovalCountRef.current = pendingCount;
      return;
    }
    
    if (pendingCount > prevApprovalCountRef.current) {
      const newCount = pendingCount - prevApprovalCountRef.current;
      toast.info(`${newCount} new approval${newCount > 1 ? 's' : ''} required`, {
        action: {
          label: 'View',
          onClick: () => {
            window.location.href = '/dashboard/activity?filter=approvals';
          },
        },
      });
    }
    prevApprovalCountRef.current = pendingCount;
  }, [pendingCount]);
}
