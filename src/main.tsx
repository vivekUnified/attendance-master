import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  import('./utils/seedDemoData').then(({ seedDemoData }) => {
    (window as unknown as { seedDemoData: typeof seedDemoData }).seedDemoData = seedDemoData;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
