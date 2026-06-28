import axios from "axios";

// Fallback to your local port if the environment variable isn't loaded
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

// Strip any trailing slash to prevent double-slash issues (e.g., domain.com//api)
const CLEAN_BASE_URL = BACKEND_URL.replace(/\/$/, "");

export const API = `${CLEAN_BASE_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("rm_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
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