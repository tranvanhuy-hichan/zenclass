import { HeadSkeleton, CardsSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <div><HeadSkeleton /><CardsSkeleton n={4} cols="lg:grid-cols-2 2xl:grid-cols-3" /></div>;
}
