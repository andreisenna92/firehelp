import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

export function AuthorAvatar({ userId, name }: { userId: string | null; name: string | null }) {
  const author = useQuery({
    queryKey: ["author_avatar", userId], enabled: Boolean(userId), staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return null;
      const result = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
      return result.data;
    },
  });
  return <Avatar className="size-6"><AvatarImage src={author.data?.avatar_url ?? undefined} alt={name ?? "Autor"} /><AvatarFallback>{(name ?? "M").slice(0, 1)}</AvatarFallback></Avatar>;
}