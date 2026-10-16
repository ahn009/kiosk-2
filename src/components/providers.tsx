"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { configureApiClient } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";

function ApiConfigurator({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    configureApiClient({
      getToken: () => useAppStore.getState().authToken,
      onUnauthorized: () => useAppStore.getState().logout(),
    });
  }, []);
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <ApiConfigurator>{children}</ApiConfigurator>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
