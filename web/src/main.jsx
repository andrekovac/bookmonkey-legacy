import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initTheme } from './hooks/useTheme';
import './styles/theme.css';

initTheme();

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
