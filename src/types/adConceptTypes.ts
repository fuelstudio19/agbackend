export interface AdConcept {
  id: string;
  title: string;
  audience: string;
  hook: string;
  styleType: string;
  description: string;
  visualHint?: string;
}

export interface GeneratedConceptsData {
  concepts: AdConcept[];
}

export interface GenerateConceptsRequest {
  userImageUrls: string[];
  competitorImageUrls: string[];
}

export interface GenerateConceptsResponse {
  success: boolean;
  data?: GeneratedConceptsData;
  message?: string;
  metadata?: {
    model?: string;
    processingTime?: number;
    conceptsGenerated?: number;
  };
}

export interface DbAdConcept {
  id?: string;
  organisation_id: string;
  concept_json: GeneratedConceptsData;
  user_image_urls?: string[];
  competitor_image_urls?: string[];
  model_used?: string;
  processing_time_ms?: number;
  generation_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ListAdConceptsRequest {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface ListAdConceptsResponse {
  success: boolean;
  data: DbAdConcept[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  message?: string;
} 