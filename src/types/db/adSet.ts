export interface DbAdSet {
    id: string;
    ad_set_id?: string;
    account_id: string;
    campaign_id: string;
    name: string;
    status?: string;
    effective_status?: string;
    daily_budget?: number;
    lifetime_budget?: number;
    start_time?: string;
    stop_time?: string;
    bid_amount?: number;
    bid_strategy?: string;
    billing_event?: string;
    optimization_goal?: string;
    destination_type?: string;
    end_time?: string;
    targeting?: any;
    insights?: any;
    insights_date_start?: string;
    insights_date_stop?: string;
    created_at?: string;
    updated_at?: string;
    organisation_id: string;
} 