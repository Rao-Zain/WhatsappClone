import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "./index.css";
import "./theme/theme.css";
import "./theme/swal.css";
import App from './App.jsx'
import "./pwa/install";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

registerServiceWorker();

createRoot(document.getElementById('root')).render(
 
    <App />
 
)