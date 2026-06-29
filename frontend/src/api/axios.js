import axios from "axios";

// Fallback to your local port if the environment variable isn't loaded
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

// Strip any trailing slash to prevent double-slash issues (e.g., domain.com//api)
const CLEAN_BASE_URL = BACKEND_URL.replace(/\/$/, "");

export const API = `${CLEAN_BASE_URL}/api`;

const api = axios.create({ baseURL: API });

// ==========================================
// GLOBAL LOADER LOGIC
// ==========================================
let activeRequests = 0;

const showLoader = () => {
  if (activeRequests === 0) {
    let loader = document.getElementById("global-api-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "global-api-loader";
      // Full screen overlay that blocks clicks to "pause" the app
      loader.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(2px);
        z-index: 99999; display: flex; justify-content: center; align-items: center;
      `;
      // Orange spinner animation
      loader.innerHTML = `
        <style>
          @keyframes rm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .rm-spinner { 
            width: 45px; height: 45px; 
            border: 4px solid #E2E8F0; 
            border-top: 4px solid #E65C00; 
            border-radius: 50%; 
            animation: rm-spin 0.8s linear infinite; 
          }
        </style>
        <div class="rm-spinner"></div>
      `;
      document.body.appendChild(loader);
    }
  }
  activeRequests++;
};

const hideLoader = () => {
  // Decrease count, ensure it never goes below 0
  activeRequests = Math.max(0, activeRequests - 1); 
  if (activeRequests === 0) {
    const loader = document.getElementById("global-api-loader");
    if (loader) loader.remove();
  }
};
// ==========================================


// Intercept Requests (Turn Loader ON)
api.interceptors.request.use((config) => {
  showLoader(); 
  
  const t = localStorage.getItem("rm_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
}, (error) => {
  hideLoader(); // Hide if the request fails before leaving the app
  return Promise.reject(error);
});


// Intercept Responses (Turn Loader OFF)
api.interceptors.response.use(
  (r) => {
    hideLoader(); 
    return r;
  },
  (err) => {
    hideLoader(); // Ensure loader hides even if the API throws an error
    
    if (err?.response?.status === 401) {
      localStorage.removeItem("rm_token");
      localStorage.removeItem("rm_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;