import { PageSkeleton } from "@/components/ui/Skeleton";
export default function Loading() { return <PageSkeleton statCount={3} tableRows={8} tableCols={5} hasSearch={false} />; }
