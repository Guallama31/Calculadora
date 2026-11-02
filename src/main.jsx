import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { AppProvider } from './app/AppContext.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <AppProvider><App /></AppProvider>,
);
