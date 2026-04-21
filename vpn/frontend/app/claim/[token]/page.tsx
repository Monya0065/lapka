"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ClaimPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const claim = async () => {
      try {
        const res = await fetch("/api/devices/claim", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          router.push("/dashboard/profiles");
        } else {
          const data = await res.json();
          setError(data.detail || "Invalid token");
        }
      } catch (err) {
        setError("Failed to claim device");
      } finally {
        setLoading(false);
      }
    };

    if (localStorage.getItem("access_token")) {
      claim();
    } else {
      router.push(`/login?claim=${token}`);
    }
  }, [token, router]);

  if (loading) return <div className="container">Активация...</div>;
  if (error) return <div className="container">Ошибка: {error}</div>;

  return null;
}