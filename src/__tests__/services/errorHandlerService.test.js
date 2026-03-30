jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('errorHandlerService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('logs error entries with type, message, and context', () => {
    const {
      logError,
      getErrorLog,
      clearErrorLog,
    } = require('../../services/errorHandlerService');

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    clearErrorLog();
    logError('RuntimeError', new Error('boom'), { screen: 'Checkout' });

    const logs = getErrorLog();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toEqual(
      expect.objectContaining({
        type: 'RuntimeError',
        message: 'boom',
        context: { screen: 'Checkout' },
        source: 'mobile-app',
      })
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[RuntimeError] boom',
      expect.objectContaining({
        context: { screen: 'Checkout' },
      })
    );

    consoleSpy.mockRestore();
  });

  it('keeps only the latest 50 logs', () => {
    const {
      logError,
      getErrorLog,
      clearErrorLog,
    } = require('../../services/errorHandlerService');

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    clearErrorLog();
    for (let i = 0; i < 55; i += 1) {
      logError('RuntimeError', new Error(`err-${i}`));
    }

    const logs = getErrorLog();
    expect(logs).toHaveLength(50);
    expect(logs[0].message).toBe('err-5');
    expect(logs[49].message).toBe('err-54');

    consoleSpy.mockRestore();
  });

  it('clears error log queue', () => {
    const {
      logError,
      getErrorLog,
      clearErrorLog,
    } = require('../../services/errorHandlerService');

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    clearErrorLog();
    logError('RuntimeError', 'simple failure');
    expect(getErrorLog()).toHaveLength(1);

    clearErrorLog();
    expect(getErrorLog()).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('installs global handlers and routes callbacks to logError', () => {
    const setGlobalHandler = jest.fn();
    const processOn = jest.fn();

    global.ErrorUtils = { setGlobalHandler };
    global.process = { on: processOn };

    const {
      setupGlobalErrorHandlers,
      getErrorLog,
      clearErrorLog,
    } = require('../../services/errorHandlerService');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    clearErrorLog();
    setupGlobalErrorHandlers();

    expect(setGlobalHandler).toHaveBeenCalledTimes(1);
    expect(processOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

    const runtimeHandler = setGlobalHandler.mock.calls[0][0];
    const rejectionHandler = processOn.mock.calls[0][1];

    runtimeHandler(new Error('fatal crash'), true);
    rejectionHandler(new Error('promise crash'), Promise.resolve());

    const logs = getErrorLog();
    expect(logs.map((l) => l.type)).toEqual(['FatalError', 'UnhandledPromiseRejection']);

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    delete global.ErrorUtils;
    delete global.process;
  });

  it('shows alert with defaults and custom message', () => {
    const { Alert } = require('react-native');
    const { showErrorAlert } = require('../../services/errorHandlerService');

    showErrorAlert();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Something went wrong', [{ text: 'OK' }]);

    showErrorAlert('Network Error', 'Please try again later');
    expect(Alert.alert).toHaveBeenLastCalledWith('Network Error', 'Please try again later', [{ text: 'OK' }]);
  });
});
