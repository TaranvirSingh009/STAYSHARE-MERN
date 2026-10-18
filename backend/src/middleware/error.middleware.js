export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || "Something went wrong";

  if (err.code === 11000) {
    statusCode = 409;
    message = "A record with this value already exists";
  } else if (err.name === "ValidationError" || err.name === "CastError") {
    statusCode = 400;
  } else if (err.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Images must be 5 MB or smaller" : err.message;
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong"
      : message,
  });
};
