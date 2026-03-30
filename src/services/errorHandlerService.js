import { Alert } from 'react-native';

/**
 * Global error handler – captures unhandled errors and exceptions
 * Logs to console for now; can be upgraded to Sentry/BugSnag later
 */

let errorLogQueue = [];
const MAX_LOGS = 50; // Keep last 50 errors in memory for debugging

// Setup handlers
export const setupGlobalErrorHandlers = () => {
  // Handle promise rejections
  const handleUnhandledRejection = (reason, promise) => {
    logError('UnhandledPromiseRejection', reason);
  };

  // Handle runtime errors
  const handleError = (error, isFatal) => {
    logError(isFatal ? 'FatalError' : 'RuntimeError', error);
  };

  // React Native error handler
  if (global.ErrorUtils) {
    global.ErrorUtils.setGlobalHandler(handleError);
  }

  if (global.process && global.process.on) {
    global.process.on('unhandledRejection', handleUnhandledRejection);
  }

  console.log('[ErrorHandler] Global error handlers installed');
};

/**
 * Log an error with context
 */
export const logError = (type, error, context = {}) => {
  const errorLog = {
    type,
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack || null,
    context,
    source: 'mobile-app'
  };

  // Store in queue
  errorLogQueue.push(errorLog);
  if (errorLogQueue.length > MAX_LOGS) {
    errorLogQueue.shift(); // Remove oldest if we exceed max
  }

  // Log to console
  console.error(`[${type}] ${errorLog.message}`, {
    stack: errorLog.stack,
    context: errorLog.context
  });
};

/**
 * Get all logged errors (for debugging)
 */
export const getErrorLog = () => {
  return [...errorLogQueue];
};

/**
 * Clear error log
 */
export const clearErrorLog = () => {
  errorLogQueue = [];
};

/**
 * Report error to user
 */
export const showErrorAlert = (title = 'Error', message = 'Something went wrong') => {
  Alert.alert(title, message, [{ text: 'OK' }]);
};
