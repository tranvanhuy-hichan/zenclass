import { HeadSkeleton, TabsSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton action={false} /><TabsSkeleton n={2} /><ToolbarSkeleton /><TableSkeleton rows={10} cols={6} /></div>;
}
