import { HeadSkeleton, FormSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div><HeadSkeleton action={false} /><FormSkeleton /></div>
  );
}
