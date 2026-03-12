import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await client.api.health.$get();
      if (!res.ok) throw new Error("Health check failed");
      return res.json();
    },
  });
}
