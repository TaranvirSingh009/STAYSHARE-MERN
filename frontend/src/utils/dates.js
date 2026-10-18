export const todayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDate = (value, options = { day: "numeric", month: "short", year: "numeric" }) => {
  const dateOnly = String(value).slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", options);
};
