import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/inter';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import './styles/app.css';

import { App } from './App';
import { WalletProviders } from './wallet/WalletProviders';

/* Solana web3.js expects a Node-style Buffer global in the browser. */
(globalThis as Record<string, unknown>).Buffer = Buffer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WalletProviders>
  </StrictMode>,
);
