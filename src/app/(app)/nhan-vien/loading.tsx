import { HeadSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton /><ToolbarSkeleton /><TableSkeleton rows={10} cols={5} /></div>
  );
}
