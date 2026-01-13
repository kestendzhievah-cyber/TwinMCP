export interface SearchQuery {
  query: string;
  context?: {
    userTags?: string[];
    userPreferences?: {
      languages?: string[];
      licenses?: string[];
      quality?: 'high' | 'medium' | 'any';
    };
    previousSearches?: string[];
    projectContext?: {
      dependencies?: string[];
      framework?: string;
    };
  };
  filters?: {
    tags?: string[];
    language?: string;
    license?: string;
    status?: string;
    minQuality?: number;
    minPopularity?: number;
  };
  options?: {
    fuzzy?: boolean;
    suggestions?: boolean;
    includeDeprecated?: boolean;
    boostRecent?: boolean;
  };
}

export interface SearchResult {
  library: Library;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'contextual';
  matchDetails: {
    nameMatch?: number;
    descriptionMatch?: number;
    tagMatch?: number;
    contextMatch?: number;
    popularityBoost?: number;
    qualityBoost?: number;
  };
  explanation: string;
  clicked?: boolean;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  facets: SearchFacets;
  suggestions?: string[] | undefined;
  corrections?: string[] | undefined;
  didYouMean?: string[] | undefined;
  searchTime: number;
  queryProcessed: string;
}

export interface SearchFacets {
  tags: Array<{ name: string; count: number; relevance: number }>;
  languages: Array<{ name: string; count: number; relevance: number }>;
  licenses: Array<{ name: string; count: number; relevance: number }>;
  categories: Array<{ name: string; count: number; relevance: number }>;
}

export interface Library {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  githubUrl?: string;
  npmUrl?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  license?: string;
  latestVersion?: string;
  totalDownloads?: number;
  weeklyDownloads?: number;
  stars?: number;
  forks?: number;
  issues?: number;
  language?: string;
  status?: string;
  qualityScore?: number;
  popularityScore?: number;
  maintenanceScore?: number;
  lastUpdatedAt?: Date;
  lastCrawledAt?: Date;
  tags?: LibraryTag[];
}

export interface LibraryTag {
  id: string;
  name: string;
  category?: string;
  description?: string;
  color?: string;
}

export interface SearchLog {
  id: string;
  query: string;
  userId?: string;
  resultCount: number;
  clickedResult?: string;
  searchTime: number;
  createdAt: Date;
}

export interface SearchClick {
  id: string;
  libraryId: string;
  query: string;
  userId?: string;
  position: number;
  createdAt: Date;
}

export interface SearchRelevance {
  libraryId: string;
  query: string;
  score: number;
  lastUpdated: Date;
}
