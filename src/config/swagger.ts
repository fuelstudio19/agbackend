import swaggerJsdoc from 'swagger-jsdoc';

// We can't directly import JSON in TypeScript without additional setup,
// so we'll hardcode the version for now
const API_VERSION = '1.0.0';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Adgraam API Documentation',
      version: API_VERSION,
      description: 'Comprehensive API documentation for the Adgraam advertising management platform. This API provides endpoints for managing ad accounts, campaigns, ad sets, ads, competitor analysis, and AI-powered scraping.',
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC',
      },
      contact: {
        name: 'Adgraam API Support',
        email: 'api-support@adgraam.com',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Production API Server',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from login endpoint',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'User ID' },
            email: { type: 'string', format: 'email', description: 'User email address' },
            name: { type: 'string', description: 'User full name' },
            created_at: { type: 'string', format: 'date-time', description: 'Account creation timestamp' },
            updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
          },
          required: ['id', 'email', 'name'],
        },
        AdAccount: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Ad Account ID with prefix (e.g., act_12345)' },
            account_id: { type: 'string', description: 'Ad Account ID without prefix (e.g., 12345)' },
            name: { type: 'string', description: 'Ad Account Name' },
            currency: { type: 'string', nullable: true, description: 'Currency code (e.g., USD)' },
            account_status: { type: 'integer', nullable: true, description: 'Account status code (e.g., 1=Active, 2=Disabled)' },
            business_name: { type: 'string', nullable: true, description: 'Associated business name' },
            timezone_name: { type: 'string', nullable: true, description: 'Timezone name (e.g., America/Los_Angeles)' },
            timezone_offset_hours_utc: { type: 'number', format: 'float', nullable: true, description: 'Timezone offset from UTC in hours' },
            business_country_code: { type: 'string', nullable: true, description: 'Business country code (e.g., US)' },
            amount_spent: { type: 'string', nullable: true, description: 'Total amount spent (string representation)' },
            min_campaign_group_spend_cap: { type: 'string', nullable: true, description: 'Minimum campaign group spend cap (string representation)' },
          },
          required: ['id', 'account_id', 'name'],
        },
        Campaign: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Campaign ID' },
            account_id: { type: 'string', description: 'Ad Account ID associated with the campaign' },
            name: { type: 'string', description: 'Campaign Name' },
            objective: { type: 'string', nullable: true, description: 'Campaign objective' },
            status: { type: 'string', nullable: true, description: 'Campaign status (e.g., ACTIVE, PAUSED)' },
            effective_status: { type: 'string', nullable: true, description: 'Effective campaign status (e.g., ACTIVE, PAUSED, ARCHIVED)' },
            buying_type: { type: 'string', nullable: true, description: 'Buying type (e.g., AUCTION, FIXED_PRICE)' },
            daily_budget: { type: 'string', nullable: true, description: 'Daily budget amount (string representation)' }, // Often returned as string by API
            lifetime_budget: { type: 'string', nullable: true, description: 'Lifetime budget amount (string representation)' }, // Often returned as string by API
            start_time: { type: 'string', format: 'date-time', nullable: true, description: 'Campaign start time' },
            stop_time: { type: 'string', format: 'date-time', nullable: true, description: 'Campaign stop time' },
            insights: {
              type: 'object',
              nullable: true,
              description: 'Performance insights for the campaign',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      cpc: { type: 'string', nullable: true, description: 'Cost per click' },
                      ctr: { type: 'string', nullable: true, description: 'Click-through rate' },
                      impressions: { type: 'string', nullable: true, description: 'Number of impressions' },
                      date_start: { type: 'string', format: 'date', nullable: true, description: 'Start date of insights data' },
                      date_stop: { type: 'string', format: 'date', nullable: true, description: 'End date of insights data' }
                    }
                  }
                },
                paging: { $ref: '#/components/schemas/FacebookPaging' }
              }
            },
            insights_date_start: { type: 'string', format: 'date', nullable: true, description: 'Start date of insights data' },
            insights_date_stop: { type: 'string', format: 'date', nullable: true, description: 'End date of insights data' }
          },
          required: ['id', 'account_id', 'name'], // Only core fields are truly required
        },
        AdSet: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Ad Set ID' },
            account_id: { type: 'string', description: 'Ad Account ID' },
            campaign_id: { type: 'string', description: 'Campaign ID associated with the Ad Set' },
            name: { type: 'string', description: 'Ad Set Name' },
            status: { type: 'string', nullable: true, description: 'Ad Set status (e.g., ACTIVE, PAUSED)' },
            effective_status: { type: 'string', nullable: true, description: 'Effective Ad Set status' },
            daily_budget: { type: 'string', nullable: true, description: 'Daily budget amount (string representation)' },
            lifetime_budget: { type: 'string', nullable: true, description: 'Lifetime budget amount (string representation)' },
            start_time: { type: 'string', format: 'date-time', nullable: true, description: 'Ad Set start time' },
            end_time: { type: 'string', format: 'date-time', nullable: true, description: 'Ad Set end time' }, // Note: FB Graph API might use end_time
            optimization_goal: { type: 'string', nullable: true, description: 'Optimization goal (e.g., REACH, LINK_CLICKS)' },
            billing_event: { type: 'string', nullable: true, description: 'Billing event (e.g., IMPRESSIONS, LINK_CLICKS)' },
            targeting: { type: 'object', nullable: true, description: 'Targeting specifications (complex object)' }, // Define more specifically if needed
          },
          required: ['id', 'account_id', 'campaign_id', 'name'],
        },
        Ad: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Ad ID' },
            account_id: { type: 'string', description: 'Ad Account ID' },
            campaign_id: { type: 'string', description: 'Campaign ID' },
            adset_id: { type: 'string', description: 'Ad Set ID' },
            name: { type: 'string', description: 'Ad Name' },
            status: { type: 'string', nullable: true, description: 'Ad status (e.g., ACTIVE, PAUSED)' },
            effective_status: { type: 'string', nullable: true, description: 'Effective Ad status' },
            bid_type: { type: 'string', nullable: true, description: 'Bid type used for the ad' },
            created_time: { type: 'string', format: 'date-time', nullable: true, description: 'Time the ad was created' },
            updated_time: { type: 'string', format: 'date-time', nullable: true, description: 'Time the ad was last updated' },
            creative: { 
              type: 'object', 
              nullable: true,
              properties: { 
                id: { type: 'string', description: 'Creative ID associated with the ad' } 
              },
              description: 'Minimal creative info (ID only)'
            },
            insights: {
              type: 'object',
              nullable: true,
              description: 'Performance insights for the ad',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      cpc: { type: 'string', nullable: true, description: 'Cost per click' },
                      ctr: { type: 'string', nullable: true, description: 'Click-through rate' },
                      impressions: { type: 'string', nullable: true, description: 'Number of impressions' },
                      clicks: { type: 'string', nullable: true, description: 'Number of clicks' },
                      spend: { type: 'string', nullable: true, description: 'Amount spent' },
                      reach: { type: 'string', nullable: true, description: 'Reach' },
                      date_start: { type: 'string', format: 'date', nullable: true, description: 'Start date of insights data' },
                      date_stop: { type: 'string', format: 'date', nullable: true, description: 'End date of insights data' }
                    }
                  }
                },
                paging: { $ref: '#/components/schemas/FacebookPaging' }
              }
            },
            insights_date_start: { type: 'string', format: 'date', nullable: true, description: 'Start date of insights data' },
            insights_date_stop: { type: 'string', format: 'date', nullable: true, description: 'End date of insights data' }
          },
          required: ['id', 'account_id', 'campaign_id', 'adset_id', 'name'],
        },
        AdCreative: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Creative ID' },
            name: { type: 'string', nullable: true, description: 'Creative Name' },
            body: { type: 'string', nullable: true, description: 'Primary text/caption of the ad' },
            image_url: { type: 'string', format: 'url', nullable: true, description: 'URL of the primary image' },
            thumbnail_url: { type: 'string', format: 'url', nullable: true, description: 'URL of the creative thumbnail' },
            image_hash: { type: 'string', nullable: true, description: 'Hash of the ad image' },
            effective_object_story_id: { type: 'string', nullable: true, description: 'ID of the effective Facebook post used as the ad' },
            object_story_spec: { 
              type: 'object', 
              nullable: true,
              description: 'Specification for the ad creative content (e.g., page ID, links, message)',
              // Example properties - add more as needed
              properties: {
                page_id: { type: 'string' },
                link_data: { type: 'object' },
                video_data: { type: 'object' },
              }
            },
          },
           required: ['id']
        },
        // New schemas for competitor and self ad creatives
        CompetitorAdCreative: {
          type: 'object',
          properties: {
            ad_archive_id: { type: 'string', description: 'Unique ad archive ID from Meta Ad Library' },
            url: { type: 'string', format: 'url', description: 'Original ad URL from Meta Ad Library' },
            ad_id: { type: 'string', nullable: true, description: 'Ad ID' },
            spend: { type: 'string', nullable: true, description: 'Spend information' },
            currency: { type: 'string', nullable: true, description: 'Currency of the spend' },
            page_id: { type: 'string', nullable: true, description: 'Facebook page ID' },
            page_name: { type: 'string', nullable: true, description: 'Facebook page name' },
            page_profile_picture_url: { type: 'string', format: 'url', nullable: true, description: 'Page profile picture URL' },
            display_format: { type: 'string', nullable: true, description: 'Ad display format' },
            title: { type: 'string', nullable: true, description: 'Ad title' },
            body: { type: 'string', nullable: true, description: 'Ad body text' },
            caption: { type: 'string', nullable: true, description: 'Ad caption' },
            link_url: { type: 'string', format: 'url', nullable: true, description: 'Link URL in the ad' },
            cta_text: { type: 'string', nullable: true, description: 'Call-to-action text' },
            image_urls: { 
              type: 'array', 
              items: { type: 'string', format: 'url' },
              nullable: true,
              description: 'Array of image URLs' 
            },
            is_active: { type: 'boolean', description: 'Whether the ad is currently active' },
            start_date: { type: 'string', format: 'date', nullable: true, description: 'Ad start date' },
            end_date: { type: 'string', format: 'date', nullable: true, description: 'Ad end date' },
            created_at: { type: 'string', format: 'date-time', description: 'Timestamp when scraped' },
            updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' },
          },
          required: ['ad_archive_id'],
        },
        SelfAdCreative: {
          type: 'object',
          allOf: [
            { $ref: '#/components/schemas/CompetitorAdCreative' },
            {
              type: 'object',
              properties: {
                organization_id: { type: 'string', description: 'Organization ID that owns this ad' },
              },
              required: ['organization_id'],
            }
          ],
        },
        // Onboarding schemas
        OnboardingResponse: {
          type: 'object',
          properties: {
            company_name: { type: 'string', description: 'Company name' },
            company_url: { type: 'string', format: 'url', description: 'Company website URL' },
            short_write_up: { type: 'string', description: 'Brief company description' },
            logo: { type: 'string', format: 'url', nullable: true, description: 'Company logo URL' },
            competitors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Competitor name' },
                  url: { type: 'string', format: 'url', description: 'Competitor website URL' },
                  meta_ad_library_url: { type: 'string', format: 'url', description: 'Meta Ad Library URL for this competitor' },
                  short_write_up: { type: 'string', nullable: true, description: 'Brief competitor description' },
                  logo: { type: 'string', format: 'url', nullable: true, description: 'Competitor logo URL' },
                },
                required: ['name', 'url', 'meta_ad_library_url'],
              },
              description: 'Array of identified competitors'
            },
            industries: {
              type: 'array',
              items: { type: 'string' },
              description: 'Industries the company operates in'
            },
            target_audience: {
              type: 'array',
              items: { type: 'string' },
              description: 'Identified target audience segments'
            },
            core_products_services: {
              type: 'array',
              items: { type: 'string' },
              description: 'Main products or services offered'
            },
          },
          required: ['company_name', 'company_url', 'short_write_up'],
        },
        // Scraping schemas
        ScrapingStartResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Operation success status' },
            message: { type: 'string', description: 'Status message' },
            data: {
              type: 'object',
              properties: {
                run_id: { type: 'string', description: 'Unique ID to track scraping progress' },
                polling_status: {
                  type: 'object',
                  nullable: true,
                  description: 'Background polling status information',
                  properties: {
                    is_active: { type: 'boolean' },
                    next_poll_time: { type: 'string', format: 'date-time' },
                  }
                },
              },
              required: ['run_id'],
            },
          },
          required: ['success', 'message', 'data'],
        },
        ScrapingResultResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', description: 'Operation success status' },
            message: { type: 'string', description: 'Status message' },
            data: {
              oneOf: [
                {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CompetitorAdCreative' },
                  description: 'Array of scraped ad creatives (when completed)'
                },
                {
                  type: 'null',
                  description: 'Null when scraping is still in progress'
                }
              ]
            },
          },
          required: ['success', 'message'],
        },
        QueueMonitoringResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                queue_stats: {
                  type: 'object',
                  properties: {
                    waiting: { type: 'integer', description: 'Number of jobs waiting' },
                    active: { type: 'integer', description: 'Number of active jobs' },
                    completed: { type: 'integer', description: 'Number of completed jobs' },
                    failed: { type: 'integer', description: 'Number of failed jobs' },
                    delayed: { type: 'integer', description: 'Number of delayed jobs' },
                  }
                },
                recent_jobs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      data: { type: 'object' },
                      opts: { type: 'object' },
                      progress: { type: 'integer' },
                      delay: { type: 'integer', nullable: true },
                      timestamp: { type: 'integer' },
                      attemptsMade: { type: 'integer' },
                      failedReason: { type: 'string', nullable: true },
                      stacktrace: { type: 'array', items: { type: 'string' }, nullable: true },
                      returnvalue: { type: 'object', nullable: true },
                      finishedOn: { type: 'integer', nullable: true },
                      processedOn: { type: 'integer', nullable: true },
                    }
                  }
                }
              }
            }
          }
        },
        AdInsight: {
          type: 'object',
          description: 'Performance metrics for an ad, campaign, ad set, or account',
          properties: {
            // Core IDs/Context
            account_id: { type: 'string', nullable: true, description: 'Ad Account ID' },
            campaign_id: { type: 'string', nullable: true, description: 'Campaign ID' },
            adset_id: { type: 'string', nullable: true, description: 'Ad Set ID' },
            ad_id: { type: 'string', nullable: true, description: 'Ad ID' },
            // Time 
            date_start: { type: 'string', format: 'date', nullable: true, description: 'Start date of the data range' },
            date_stop: { type: 'string', format: 'date', nullable: true, description: 'End date of the data range' },
            // Performance Metrics
            impressions: { type: 'integer', nullable: true },
            clicks: { type: 'integer', nullable: true },
            reach: { type: 'integer', nullable: true },
            frequency: { type: 'number', format: 'float', nullable: true },
            spend: { type: 'number', format: 'float', nullable: true, description: 'Amount spent (in account currency)' },
            cpm: { type: 'number', format: 'float', nullable: true, description: 'Cost per 1000 impressions' },
            cpc: { type: 'number', format: 'float', nullable: true, description: 'Cost per click' },
            ctr: { type: 'number', format: 'float', nullable: true, description: 'Click-through rate (%)' },
            unique_clicks: { type: 'integer', nullable: true },
            outbound_clicks: { type: 'integer', nullable: true, description: 'Clicks leading off Facebook' },
            // Actions / Conversions
            actions: { 
              type: 'array', 
              nullable: true,
              items: { 
                type: 'object',
                properties: { action_type: { type: 'string' }, value: { type: 'integer' } }
              },
              description: 'Array of actions taken (e.g., link_click, post_engagement, purchase)'
            },
            cost_per_action_type: {
              type: 'array',
              nullable: true,
              items: {
                type: 'object',
                properties: { action_type: { type: 'string' }, value: { type: 'number', format: 'float' } }
              },
              description: 'Cost associated with each action type'
            },
            // Other
            objective: { type: 'string', nullable: true, description: 'Objective of the parent campaign/ad set' },
          },
        },
        BreakdownInsight: {
          allOf: [
            { $ref: '#/components/schemas/AdInsight' }, // Inherits base insight fields
            {
              type: 'object',
              description: 'AdInsight data including breakdown dimensions',
              properties: {
                // Breakdown Dimensions (add more as needed from FB API)
                age: { type: 'string', nullable: true, description: 'Age bracket breakdown (e.g., 18-24)' },
                gender: { type: 'string', nullable: true, description: 'Gender breakdown (e.g., male, female)' },
                country: { type: 'string', nullable: true, description: 'Country code breakdown (e.g., US, GB)' },
                publisher_platform: { type: 'string', nullable: true, description: 'Platform breakdown (e.g., facebook, instagram)' },
                platform_position: { type: 'string', nullable: true, description: 'Placement position (e.g., feed, story)' },
                device_platform: { type: 'string', nullable: true, description: 'Device breakdown (e.g., mobile, desktop)' },
                action_type: { type: 'string', nullable: true, description: 'Breakdown by specific action type (used with action breakdowns)' },
                hourly_stats_aggregated_by_advertiser_time_zone: { type: 'string', nullable: true, description: 'Hourly breakdown key (00:00 - 23:00) in advertiser timezone' },
                hourly_stats_aggregated_by_audience_time_zone: { type: 'string', nullable: true, description: 'Hourly breakdown key (00:00 - 23:00) in audience timezone' },
              }
            }
          ]
        },
        DetailedAdInsightResponse: {
          type: 'object',
          properties: {
            ad_details: { $ref: '#/components/schemas/Ad', nullable: true },
            insights: {
              type: 'array',
              items: { $ref: '#/components/schemas/AdInsight' },
              description: 'Overall insights for the ad without breakdowns'
            },
            breakdown_insights: {
              type: 'object',
              description: 'Insights broken down by requested dimensions',
              properties: {
                placement: { type: 'array', items: { $ref: '#/components/schemas/BreakdownInsight' }, nullable: true },
                audience: { type: 'array', items: { $ref: '#/components/schemas/BreakdownInsight' }, nullable: true },
                geo: { type: 'array', items: { $ref: '#/components/schemas/BreakdownInsight' }, nullable: true },
                action: { type: 'array', items: { $ref: '#/components/schemas/BreakdownInsight' }, nullable: true },
                device: { type: 'array', items: { $ref: '#/components/schemas/BreakdownInsight' }, nullable: true },
                hourly: { type: 'array', items: { $ref: '#/components/schemas/BreakdownInsight' }, nullable: true },
              },
            },
          },
        },
        GetDetailedAdInsightsRequest: {
          type: 'object',
          properties: {
            time_range: {
              type: 'object',
              required: ['since', 'until'],
              properties: {
                since: { type: 'string', format: 'date', description: "Start date (YYYY-MM-DD)" },
                until: { type: 'string', format: 'date', description: "End date (YYYY-MM-DD)" },
              },
            },
            include_placement_breakdown: { type: 'boolean', description: "Include platform and placement breakdown" },
            include_audience_breakdown: { type: 'boolean', description: "Include age and gender breakdown" },
            include_geo_breakdown: { type: 'boolean', description: "Include geographic breakdown" },
            include_action_breakdown: { type: 'boolean', description: "Include action type breakdown" },
            include_device_breakdown: { type: 'boolean', description: "Include device breakdown" },
            include_hourly_breakdown: { type: 'boolean', description: "Include hourly stats breakdown" },
          },
          required: ['time_range'],
        },
        GetAdInsightsRequest: {
          type: 'object',
          properties: {
            time_range: {
              type: 'object',
              properties: {
                since: { type: 'string', format: 'date' },
                until: { type: 'string', format: 'date' },
              },
              required: ['since', 'until'],
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
            },
            breakdowns: {
              type: 'array',
              items: { type: 'string' },
            },
            time_increment: { type: 'integer' },
          },
          required: ['time_range', 'fields'],
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            status: { type: 'integer' },
          },
        },
        RegisterResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Status message' },
            userId: { type: 'string', description: 'ID of the registered user' },
          },
        },
        Session: { // Simplified representation of Supabase session
          type: 'object',
          properties: {
            access_token: { type: 'string', description: 'JWT access token' },
            token_type: { type: 'string', example: 'bearer' },
            expires_in: { type: 'integer', description: 'Token expiry in seconds' },
            expires_at: { type: 'integer', description: 'Unix timestamp of token expiry' },
            refresh_token: { type: 'string', description: 'Refresh token' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Status message' },
            session: { $ref: '#/components/schemas/Session' },
          },
        },
        UserProfileResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
          },
        },
        FacebookPaging: {
          type: 'object',
          description: 'Facebook API paging information',
          properties: {
            cursors: {
              type: 'object',
              properties: {
                before: { type: 'string', nullable: true, description: 'Cursor for previous page' },
                after: { type: 'string', nullable: true, description: 'Cursor for next page' }
              }
            },
            previous: { type: 'string', nullable: true, description: 'URL for the previous page' },
            next: { type: 'string', nullable: true, description: 'URL for the next page' }
          }
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        AdListResponse: {
          description: 'List of ads',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/Ad',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // path to the API docs
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec; 