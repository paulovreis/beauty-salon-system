import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Guardrail: em produção, evita acesso via HTTP (Mixed Content / cookies / segurança).
// Não afeta desenvolvimento local em http://localhost.
if (typeof window !== 'undefined') {
  const { protocol, hostname, href } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (protocol === 'http:' && !isLocalhost) {
    window.location.replace(href.replace(/^http:/, 'https:'));
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
