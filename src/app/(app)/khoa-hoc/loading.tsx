import { HeadSkeleton, ToolbarSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton /><ToolbarSkeleton /><CardsSkeleton n={8} cols="md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" /></div>;
}
