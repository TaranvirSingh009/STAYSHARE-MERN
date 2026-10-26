export const isValidPhoneNumber = (value) => /^\d{10}$/.test(String(value || "").trim());

export const isStrongPassword = (value) =>
  typeof value === "string" &&
  value.length >= 9 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);

export const passwordRequirementsMessage =
  "Password must be at least 9 characters and include an uppercase letter, a lowercase letter, a number, and a special character";
