import chalk from 'chalk';

/**
 * Colorful logger utility for better console output
 */
export const logger = {
  /**
   * Log informational message (blue)
   */
  info: (message: string, ...args: any[]) => {
    console.log(chalk.blue(message), ...args);
  },

  /**
   * Log success message (green)
   */
  success: (message: string, ...args: any[]) => {
    console.log(chalk.green(message), ...args);
  },

  /**
   * Log warning message (yellow)
   */
  warn: (message: string, ...args: any[]) => {
    console.warn(chalk.yellow(message), ...args);
  },

  /**
   * Log error message (red)
   */
  error: (message: string, ...args: any[]) => {
    console.error(chalk.red(message), ...args);
  },

  /**
   * Log debug message (cyan)
   */
  debug: (message: string, ...args: any[]) => {
    console.log(chalk.cyan(message), ...args);
  },

  /**
   * Log server message (magenta)
   */
  server: (message: string, ...args: any[]) => {
    console.log(chalk.magenta(message), ...args);
  }
}; 