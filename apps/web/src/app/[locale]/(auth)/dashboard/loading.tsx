import { MetricsSkeleton, PanelSkeleton } from '@/components/ui/skeletons';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <MetricsSkeleton />
      <PanelSkeleton />
    </div>
  );
}
