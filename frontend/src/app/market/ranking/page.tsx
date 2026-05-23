"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OldRankingRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/ranking");
    }, [router]);
    return null;
}
