import { auth }       from "@/auth";
import { redirect }   from "next/navigation";
import GoogleSignIn   from "@/components/Google";
import PendingScreen  from "@/components/PendingScreen";

export const revalidate = 0;

interface Props {
  searchParams: Promise<{ notice?: string; error?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const { notice, error } = await searchParams;
  const session           = await auth();

  // Already signed-in users should not linger on the login page
  if (session?.user?.id) {
    redirect("/welcome");
  }

  if (notice === "pending") {
    return <PendingScreen />;
  }

  return <GoogleSignIn authError={error} />;
}
