import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function MissionNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Mission not found</h2>
      <p className="text-muted-foreground text-center mb-6">
        The mission you're looking for doesn't exist or has been removed.
      </p>
      <Button asChild>
        <Link href="/dashboard/missions">Back to Missions</Link>
      </Button>
    </div>
  );
}
