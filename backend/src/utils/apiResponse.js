export const ApiResponse = {
  success: (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  },
  error: (res, message = 'Error', statusCode = 500) => {
    return res.status(statusCode).json({
      success: false,
      message,
    });
  },
};
