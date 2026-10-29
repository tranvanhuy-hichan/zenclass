import { HeadSkeleton, ToolbarSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton /><ToolbarSkeleton /><CardsSkeleton n={9} /></div>
  );
}
