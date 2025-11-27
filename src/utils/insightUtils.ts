import { AdInsight, BreakdownInsight } from '../types/graphApiTypes';

/**
 * Extracts minimal breakdown data from a full insight object, dynamically capturing all actions.
 * @param insight The full AdInsight object from the API.
 * @param breakdownKeys The keys defining this breakdown (e.g., ['age', 'gender']).
 * @returns A minimal BreakdownInsight object.
 */
export const extractMinimalBreakdown = (insight: AdInsight, breakdownKeys: string[]): BreakdownInsight => {
    const minimalInsight: BreakdownInsight = {};

    // 1. Copy breakdown dimension keys
    breakdownKeys.forEach(key => {
        if (insight.hasOwnProperty(key)) {
            minimalInsight[key] = insight[key];
        }
    });

    // 2. Copy standard metrics (convert strings to numbers where applicable)
    minimalInsight.spend = parseFloat(insight.spend || '0');
    minimalInsight.impressions = parseInt(insight.impressions || '0', 10);
    minimalInsight.clicks = parseInt(insight.clicks || '0', 10);
    minimalInsight.date_start = insight.date_start;
    minimalInsight.date_stop = insight.date_stop;
    // Add other core metrics if needed, e.g., reach, cpm, cpc, ctr
    minimalInsight.reach = parseInt(insight.reach || '0', 10);
    minimalInsight.cpm = parseFloat(insight.cpm || '0');
    minimalInsight.cpc = parseFloat(insight.cpc || '0');
    minimalInsight.ctr = parseFloat(insight.ctr || '0');
    minimalInsight.frequency = parseFloat(insight.frequency || '0');
    minimalInsight.unique_clicks = parseInt(insight.unique_clicks || '0', 10);
    minimalInsight.cost_per_unique_click = parseFloat(insight.cost_per_unique_click || '0');

    // 3. Dynamically extract all action counts and costs
    const actionsMap = new Map<string, number>();
    const costPerActionMap = new Map<string, number>();

    // Process 'actions' array
    if (Array.isArray(insight.actions)) {
        insight.actions.forEach(action => {
            if (action.action_type) {
                actionsMap.set(action.action_type, parseFloat(action.value || '0'));
            }
        });
    }

    // Process 'cost_per_action_type' array
    if (Array.isArray(insight.cost_per_action_type)) {
        insight.cost_per_action_type.forEach(action => {
            if (action.action_type) {
                costPerActionMap.set(`cost_per_${action.action_type}`, parseFloat(action.value || '0'));
            }
        });
    }
    
    // Process 'video_play_actions' specifically for video_view count
     if (Array.isArray(insight.video_play_actions)) {
         insight.video_play_actions.forEach(action => {
             if (action.action_type === 'video_view') {
                // Add to existing count if already present from 'actions' array
                 actionsMap.set('video_view', (actionsMap.get('video_view') || 0) + parseFloat(action.value || '0') );
             }
             // Can add other video actions here if needed
         });
     }

    // Process 'outbound_clicks' for count
    if (Array.isArray(insight.outbound_clicks)) {
        insight.outbound_clicks.forEach(action => {
            if (action.action_type === 'outbound_click') {
                actionsMap.set('outbound_click', (actionsMap.get('outbound_click') || 0) + parseFloat(action.value || '0') );
            }
        });
    }
    
    // Process 'website_ctr' for link_click CTR value (might be redundant if ctr is already included)
    // It might be better to store this differently if needed, as it's a rate, not a count/cost.
    // Example: store it as 'website_ctr_link_click'
    // if (Array.isArray(insight.website_ctr)) {
    //     insight.website_ctr.forEach(action => {
    //         if (action.action_type === 'link_click') {
    //             minimalInsight['website_ctr_link_click'] = parseFloat(action.value || '0');
    //         }
    //     });
    // }

    // Add all found actions to the minimal insight object
    actionsMap.forEach((value, key) => {
        minimalInsight[key] = value;
    });

    // Add all found cost_per_action values
    costPerActionMap.forEach((value, key) => {
        minimalInsight[key] = value;
    });

    return minimalInsight;
}; 