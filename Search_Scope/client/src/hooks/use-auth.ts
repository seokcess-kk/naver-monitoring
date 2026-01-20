import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  profileImageUrl: string | null;
  role: "user" | "admin" | "superadmin";
  status: "active" | "suspended" | "pending";
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function logoutRequest(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  
  if (!response.ok) {
    throw new Error("로그아웃 실패");
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries();
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
