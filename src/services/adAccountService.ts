import { getAdAccounts } from './graphApiService';
import { AdAccount } from '../types/graphApiTypes';
import { CacheService } from './cacheService';
import * as adAccountRepository from '../repositories/adAccountRepository';
import { DbAccount } from '../types/dbSchemaTypes';
import { safeGet } from '../utils/general';
import { logger } from '../utils/logger';

// Cache settings
const adAccountListCache = new CacheService<AdAccount[]>(3600); // Cache list for 1 hour

/**
 * Maps a Facebook AdAccount object from the Graph API to our DbAccount schema
 */
const mapApiAccountToDbAccount = (apiAccount: AdAccount): DbAccount => {
    // Ensure account_id exists in some form
    if (!apiAccount.account_id && !apiAccount.id) {
        logger.error(`[AdAccountService] API Account is missing both account_id and id fields`);
        throw new Error('Cannot map API Account to database schema: missing identification fields');
    }

    // Extract the ID from either format (act_123456 or 123456)
    let id: string;
    let account_id: string;
    
    if (apiAccount.id && apiAccount.id.startsWith('act_')) {
        id = apiAccount.id;
        account_id = apiAccount.id.replace('act_', '');
    } else if (apiAccount.account_id) {
        account_id = apiAccount.account_id;
        id = `act_${apiAccount.account_id}`;
    } else {
        id = apiAccount.id!; // We checked above that at least one exists
        account_id = apiAccount.id!.startsWith('act_') ? apiAccount.id!.replace('act_', '') : apiAccount.id!;
    }

    return {
        id,
        account_id,
        name: apiAccount.name || 'Unnamed Account',
        account_status: safeGet(apiAccount, 'account_status'),
        business_name: safeGet(apiAccount, 'business_name') || null,
        currency: safeGet(apiAccount, 'currency'),
        timezone_name: safeGet(apiAccount, 'timezone_name'),
        timezone_offset_hours_utc: safeGet(apiAccount, 'timezone_offset_hours_utc'),
        business_country_code: safeGet(apiAccount, 'business_country_code'),
        amount_spent: safeGet(apiAccount, 'amount_spent'),
        min_campaign_group_spend_cap: safeGet(apiAccount, 'min_campaign_group_spend_cap'),
        organisation_id: '', // Will be filled in by repository function
    };
};

/**
 * Fetches all ad accounts, with option to refresh from API.
 * If refresh is true, fetches from Graph API and updates the database.
 * Otherwise, tries to retrieve from the database first.
 * 
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 * @param accessToken - Optional access token for Graph API
 */
export const getAllAdAccounts = async (
    userId: string,
    organisationId: string,
    refresh: boolean = false
): Promise<AdAccount[]> => {
    logger.info(`[AdAccountService] Getting all ad accounts for user ${userId}, org ${organisationId}, refresh=${refresh}`);

    // If refresh=true or DB fetch fails, get from API
    if (refresh) {
        return await refreshAndStoreAllAccounts(userId, organisationId);
    }
    
    // Try DB first
    const { data: dbAccounts, error } = await adAccountRepository.getAllAccounts(userId, organisationId);
    
    if (error) {
        logger.error(`[AdAccountService] Error fetching accounts from DB:`, error);
        // Fall back to API refresh
        return await refreshAndStoreAllAccounts(userId, organisationId);
    }
    
    if (!dbAccounts || dbAccounts.length === 0) {
        logger.info(`[AdAccountService] No accounts found in DB, fetching from API`);
        // No data in DB, fetch from API
        return await refreshAndStoreAllAccounts(userId, organisationId);
    }
    
    // Data found in DB, convert DbAccount[] to AdAccount[] and return
    logger.info(`[AdAccountService] Returning ${dbAccounts.length} accounts from DB`);
    return dbAccounts.map(dbAccountToApiAccount);
};

/**
 * Fetches a specific ad account by ID, with option to refresh from API.
 * 
 * @param accountId - The account ID to fetch
 * @param userId - User ID for permission checks and DB queries
 * @param organisationId - Organisation ID for DB queries
 * @param refresh - Whether to force refresh from Graph API
 * @param accessToken - Optional access token for Graph API
 */
export const getAdAccountById = async (
    accountId: string,
    userId: string,
    organisationId: string,
    refresh: boolean = false
): Promise<AdAccount | null> => {
    logger.info(`[AdAccountService] Getting account ${accountId} for user ${userId}, org ${organisationId}, refresh=${refresh}`);
    
    // Normalize ID for consistent handling
    const numericIdPart = accountId.startsWith('act_') ? accountId.substring(4) : accountId;
    const prefixedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    
    // If refresh=true, get from API and upsert to DB
    if (refresh) {
        // Refresh all accounts (API doesn't have a get-by-id endpoint)
        const accounts = await refreshAndStoreAllAccounts(userId, organisationId);
        return accounts.find(acc => 
            acc.account_id === numericIdPart || acc.id === prefixedId
        ) || null;
    }
    
    // Try DB first
    const { data: dbAccount, error } = await adAccountRepository.getAccountById(
        prefixedId, // Always use the prefixed version for DB queries
        userId,
        organisationId
    );
    
    if (error) {
        logger.error(`[AdAccountService] Error fetching account ${accountId} from DB:`, error);
        // Fall back to API
        const accounts = await refreshAndStoreAllAccounts(userId, organisationId);
        return accounts.find(acc => 
            acc.account_id === numericIdPart || acc.id === prefixedId
        ) || null;
    }
    
    if (!dbAccount) {
        logger.info(`[AdAccountService] Account ${accountId} not found in DB, checking API`);
        // Not found in DB, try API
        const accounts = await refreshAndStoreAllAccounts(userId, organisationId);
        return accounts.find(acc => 
            acc.account_id === numericIdPart || acc.id === prefixedId
        ) || null;
    }
    
    // Found in DB, convert to API format and return
    return dbAccountToApiAccount(dbAccount);
};

// --- Helper Functions ---

/**
 * Refreshes all ad accounts from the Graph API and stores them in the database.
 * Also updates the cache.
 */
async function refreshAndStoreAllAccounts(
    userId: string,
    organisationId: string
): Promise<AdAccount[]> {
    logger.info(`[AdAccountService] Refreshing accounts from Graph API for user ${userId}`);
    
    try {
        // Fetch from Graph API
        const apiAccounts = await getAdAccounts();
        
        if (!apiAccounts || apiAccounts.length === 0) {
            logger.info(`[AdAccountService] No accounts returned from Graph API`);
            return [];
        }
        
        // Map API accounts to DB schema
        const dbAccounts = apiAccounts.map(mapApiAccountToDbAccount);
        
        // Upsert to database
        const { data: upsertedAccounts, error } = await adAccountRepository.upsertAccounts(
            dbAccounts,
            userId,
            organisationId
        );
        
        if (error) {
            logger.error(`[AdAccountService] Error upserting accounts to DB:`, error);
            // Still return the API data even if DB upsert failed
        }
        
        // Update cache
        const cacheKey = `adAccounts_${userId}`;
        adAccountListCache.set(cacheKey, apiAccounts);
        
        logger.info(`[AdAccountService] Refreshed and stored ${apiAccounts.length} accounts for user ${userId}`);
        return apiAccounts;
    } catch (error) {
        logger.error(`[AdAccountService] Error in refreshAndStoreAllAccounts:`, error);
        // Re-throw with clearer message
        if (error instanceof Error) {
            throw new Error(`Failed to refresh ad accounts: ${error.message}`);
        } else {
            throw new Error('Failed to refresh ad accounts due to an unknown error');
        }
    }
}

/**
 * Converts a database account object to the API format expected by clients
 */
function dbAccountToApiAccount(dbAccount: DbAccount): AdAccount {
    // We need to use type assertion here since we're adding fields 
    // that might not be in the AdAccount type but are in our DB schema
    const account: AdAccount = {
        id: dbAccount.id,
        account_id: dbAccount.account_id,
        name: dbAccount.name,
    };

    // Add additional fields that might not be in the type definition
    if (dbAccount.account_status !== undefined) {
        (account as any).account_status = dbAccount.account_status;
    }
    if (dbAccount.business_name !== undefined && dbAccount.business_name !== null) {
        (account as any).business_name = dbAccount.business_name;
    }
    if (dbAccount.currency !== undefined) {
        (account as any).currency = dbAccount.currency;
    }
    if (dbAccount.timezone_name !== undefined) {
        (account as any).timezone_name = dbAccount.timezone_name;
    }
    // Add new fields
    if (dbAccount.timezone_offset_hours_utc !== undefined) {
        (account as any).timezone_offset_hours_utc = dbAccount.timezone_offset_hours_utc;
    }
    if (dbAccount.business_country_code !== undefined) {
        (account as any).business_country_code = dbAccount.business_country_code;
    }
    if (dbAccount.amount_spent !== undefined) {
        (account as any).amount_spent = dbAccount.amount_spent;
    }
    if (dbAccount.min_campaign_group_spend_cap !== undefined) {
        (account as any).min_campaign_group_spend_cap = dbAccount.min_campaign_group_spend_cap;
    }

    return account;
} 