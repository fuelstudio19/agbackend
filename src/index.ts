import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { initializeSupabase } from './config/supabase';
import mainRouter from './routes'; // Import the main router
import { logger } from './utils/logger';

dotenv.config();

// Initialize Supabase (optional here if only used in middleware/services)
// initializeSupabase(); 

const app: Express = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json()); // Body parser

// Debug middleware to log all requests
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});
// CORS Configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5174', 'http://localhost:5173', 'https://adgraam.com', 'https://www.staging.adgraam.com', 'https://staging.adgraam.com', 'https://www.adeve.ai', 'https://adeve.ai'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Basic Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Routes
app.get('/', (req: Request, res: Response) => {
  res.send('API is running...');
});

// Mount the main router
app.use('/api/v1', mainRouter); 

// 404 handler
app.use((req: Request, res: Response) => {
    logger.warn(`404 - Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Not Found', path: req.url });
});

// Basic Error Handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack || err.message || 'Unknown error');
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  logger.server(`⚡️[server]: Server is running at http://localhost:${port}`);
}); 