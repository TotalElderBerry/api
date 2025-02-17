import { randomBytes } from "crypto";

/**
 * Sanitize a value
 * @param value Value to sanitize
 */
export function sanitize(value: any): any {
  // If null, just return null
  if (value === null) return null;
  // if undefined, return empty string
  if (value === undefined) return '';

  // If buffer, return as is
  if (Buffer.isBuffer(value)) {
    return value;
  }

  // If number or boolean, convert to string
  if (typeof value === 'boolean') {
    return value.toString();
  }

  // List of special characters to be escaped
  const specialChars = [
    '\\', // backslash
    '<', // less than
    '>', // greater than
    '&', // ampersand
    ';', // semicolon
    '{', // opening curly brace
    '}', // closing curly brace
    '(', // opening parenthesis
    ')' // closing parenthesis
  ];

  // Escape each special character
  if (typeof value === 'string') {
    specialChars.forEach(char => {
      const regex = new RegExp(`\\${char}`, 'g');
      value = value.replace(regex, `\\${char}`);
    });
  }

  // Return the sanitized value
  return value;
}

/**
 * Sanitize an array of values
 * @param values Array of values to sanitize
 */
export function sanitizeArray(values: any[]): string[] {
  // Sanitize each value
  return values.map(value => sanitize(value));
}

/**
 * Generate secure token
 */
export function generateToken(length = 16) {
  return randomBytes(Math.floor(length / 2)).toString('hex');
}

/**
 * Generate reference number
 * @param start Starting number
 */
export function generateReference(start: number) {
  // Get date
  const date = new Date();
  // Get year, month, date
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `CSPS${year}${month < 10 ? '0' + month : month}${day < 10 ? '0' + day : day}${Math.abs(start).toString().padStart(3, '0')}`;
}