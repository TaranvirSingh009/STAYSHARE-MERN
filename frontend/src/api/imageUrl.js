const apiUrl = import.meta.env.VITE_API_URL || "/api/v1";
const apiOrigin = apiUrl.startsWith("http")
  ? apiUrl.replace(/\/api\/v1\/?$/, "")
  : "";
const placeholder = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#f1eeea"/><text x="50%" y="50%" fill="#777" font-family="sans-serif" font-size="20" text-anchor="middle">StayShare</text></svg>'
)}`;

export const imageUrl = (src) => {
  if (!src) return placeholder;
  if (/^(https?:|data:)/i.test(src)) return src;
  return `${apiOrigin}${src.startsWith("/") ? src : `/${src}`}`;
};
