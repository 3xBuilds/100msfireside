import config from '../config';

export const errorResponse = (message: string, details?: string) => ({
  success: false,
  error: message,
  ...(details && config.isDevelopment && { details })
});

export const successResponse = (data?: any, message?: string, dataPropertyName: string = 'data') => ({
  success: true,
  ...(data && { [dataPropertyName]: data }),
  ...(message && { message })
});
