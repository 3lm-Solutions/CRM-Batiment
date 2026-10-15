import { QueryClient } from '@tanstack/react-query';
import { toProblem } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Never retry 4xx (forbidden, not found, validation): only network/server errors
      retry: (count, error) => count < 2 && (toProblem(error).status === 0 || toProblem(error).status >= 500),
    },
  },
});
