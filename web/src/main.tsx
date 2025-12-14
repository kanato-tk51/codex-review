import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@mantine/core/styles.css';
import './global.css';
import { HomePage, RepoPage } from './pages/Home';

const client = new QueryClient();

const App = () => (
  <MantineProvider defaultColorScheme="light">
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/repo/:id" element={<RepoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </MantineProvider>
);

const rootEl = document.getElementById('root')!;
ReactDOM.createRoot(rootEl).render(<App />);
