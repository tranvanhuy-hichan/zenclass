import { HeadSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton /><CardsSkeleton n={6} /></div>;
}
