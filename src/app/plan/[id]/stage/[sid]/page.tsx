"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function StageRedirect() {
  const router = useRouter();
  const params = useParams();
  const planId = params.id as string;

  useEffect(() => {
    router.replace(`/plan/${planId}`);
  }, [planId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <span className="text-sm text-muted-foreground animate-pulse">跳转中...</span>
    </div>
  );
}
