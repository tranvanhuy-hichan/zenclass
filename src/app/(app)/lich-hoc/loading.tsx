import { HeadSkeleton, WeekSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton /><div className="mb-3 h-8" /><WeekSkeleton /></div>
  );
}
