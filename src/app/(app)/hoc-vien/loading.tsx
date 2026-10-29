import { HeadSkeleton, TabsSkeleton, ToolbarSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton /><TabsSkeleton /><ToolbarSkeleton /><CardsSkeleton n={12} cols="md:grid-cols-2 xl:grid-cols-3" /></div>
  );
}
