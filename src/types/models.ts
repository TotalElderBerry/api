/**
 * Student type data
 */
export type StudentType = {
  id: number;
  rid?: number;
  email: string;
  firstName: string;
  lastName: string;
  yearLevel: string;
  birthdate: string;
  password?: string;
}

/**
 * Product type data
 */
export type ProductType = {
  id: number;
  name: string;
  thumbnail: string;
  short_description: string;
  likes: number;
  stock: number;
}

/**
 * Event type data
 */
export type EventType = {
  id: number;
  title: String;
  description: String;
  thumbnail: String;
  date: Date;
  startTime: Date;
  endTime: Date;
  venue: String;
};