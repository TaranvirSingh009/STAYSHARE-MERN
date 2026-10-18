import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const url = original?.url || "";
    const skip = url.endsWith("/auth/refresh") || url.endsWith("/auth/login");
    if (original && err.response?.status === 401 && !original._retry && !skip) {
      original._retry = true;
      try {
        await api.post("/auth/refresh");
        return api(original);
      } catch {
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export const errMsg = (err) => err.response?.data?.message || "Something went wrong";

export default api;
