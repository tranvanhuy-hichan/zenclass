import { HeadSkeleton, StatsSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton action={false} /><StatsSkeleton n={4} /><TableSkeleton rows={10} cols={8} /></div>;
}
