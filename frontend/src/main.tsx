import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './app/router';
import { queryClient } from './lib/query-client';
import './index.css';
import './lib/zod-fr'; // French form messages, before any schema is used

// Theme before first paint (no light flash in dark mode)
if (localStorage.getItem('crm.theme') === 'dark') document.documentElement.classList.add('dark');

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Element #root introuvable dans index.html');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
