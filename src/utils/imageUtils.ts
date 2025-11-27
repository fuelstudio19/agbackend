/**
 * Validate image URL format
 */
export function isValidImageUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
        return false;
    }
} 