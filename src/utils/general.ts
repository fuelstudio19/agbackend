import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function safeGet<T, K extends string>(obj: T, key: K): any {
    return (obj as any)[key];
}

/**
 * Normalize a URL by removing common prefixes and converting to lowercase
 */
export const normalizeUrl = (url: string): string => {
    try {
        // Remove common prefixes and trailing slashes
        let normalized = url.trim();
        normalized = normalized.replace(/^https?:\/\//, '');
        normalized = normalized.replace(/\/+$/, '');
        normalized = normalized.toLowerCase();
        return normalized;
    } catch (error) {
        logger.warn(`Failed to normalize URL: ${url}`, error);
        return url.toLowerCase();
    }
};

/**
 * Extract domain from URL and normalize it (remove www, convert to lowercase)
 */
export const extractDomainFromUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.toLowerCase();
        // Remove www prefix
        domain = domain.replace(/^www\./, '');
        return domain;
    } catch (error) {
        logger.error(`Invalid URL provided for domain extraction: ${url}`, error);
        throw new Error('Invalid URL format');
    }
};

/**
 * Normalize company URL for consistent storage and comparison
 */
export const normalizeCompanyUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        // Ensure https protocol and remove trailing slash
        urlObj.protocol = 'https:';
        let normalized = urlObj.toString();
        normalized = normalized.replace(/\/+$/, '');
        return normalized;
    } catch (error) {
        logger.error(`Invalid company URL: ${url}`, error);
        throw new Error('Invalid company URL format');
    }
};

export const getUserAndOrgIds = (req: AuthenticatedRequest, res: Response): { userId: string; organisationId: string } | null => {
    const userId = req.user?.id;
    const organisationId = req.organisationId;

    if (!userId) {
        logger.error('[AdAccountController] User ID missing from authenticated request.');
        res.status(401).json({ message: "Unauthorized: User identifier missing." });
        return null;
    }
    if (!organisationId) {
        logger.error(`[AdAccountController] Organisation ID missing for user ${userId}.`);
        return null;
    }
    return { userId, organisationId };
};

export const getUserInfo = (req: AuthenticatedRequest, res: Response): { userId: string } | null => {
    const userId = req.user?.id;
    if (!userId) {
        logger.error('[AdAccountController] User ID missing from authenticated request.');
        res.status(401).json({ message: "Unauthorized: User identifier missing." });
        return null;
    }
    return { userId };
};

export const getOrgId = (req: AuthenticatedRequest, res: Response): { organisationId: string } | null => {
    const organisationId = req.organisationId;
    if (!organisationId) {
        logger.error('[AdAccountController] Organisation ID missing from authenticated request.');
        res.status(401).json({ message: "Unauthorized: Organisation identifier missing." });
        return null;
    }
    return { organisationId };
};

// Add utility function for default dates
export const getDefaultDates = (): { dateStart: string, dateStop: string } => {
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };
    
    return {
        dateStart: formatDate(oneWeekAgo),
        dateStop: formatDate(today)
    };
};
