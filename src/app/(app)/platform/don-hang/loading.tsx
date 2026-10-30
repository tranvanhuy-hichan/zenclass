import { HeadSkeleton, ToolbarSkeleton, TableSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton action={false} /><ToolbarSkeleton /><TableSkeleton rows={8} cols={8} /></div>;
}
