import { z } from 'zod';

// Zod schema for registration input validation
export const RegisterBodySchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    // Add any other required fields for registration (e.g., fullName)
    // data: z.object({ fullName: z.string().min(1) }).optional(), 
});

// Zod schema for login input validation
export const LoginBodySchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

// Zod schema for metaAd URL validation

// Infer TypeScript types from Zod schemas
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>; 
