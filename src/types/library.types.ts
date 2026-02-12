export interface Library {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  githubUrl?: string;
  npmUrl?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  license?: string;
  latestVersion?: string;
  totalDownloads: number;
  weeklyDownloads: number;
  stars: number;
  forks: number;
  issues: number;
  language: string;
  status: 'active' | 'deprecated' | 'archived';
  qualityScore: number;
  popularityScore: number;
  maintenanceScore: number;
  lastUpdatedAt?: Date;
  lastCrawledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryVersion {
  id: string;
  libraryId: string;
  version: string;
  isLatest: boolean;
  isPrerelease: boolean;
  releaseDate?: Date;
  downloads: number;
  deprecated: boolean;
  deprecationMessage?: string;
  engines?: {
    node?: string;
    npm?: string;
  };
  dependencies?: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  dist?: {
    size: number;
    unpackedSize: number;
  };
  createdAt: Date;
}

export interface LibraryTag {
  id: string;
  name: string;
  category?: string;
  description?: string;
  color?: string;
  createdAt: Date;
}

export interface LibraryDependency {
  id: string;
  libraryId: string;
  dependencyLibraryId?: string;
  dependencyName: string;
  versionRange?: string;
  dependencyType: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies';
  isExternal: boolean;
  createdAt: Date;
}

export interface Maintainer {
  id: string;
  githubUsername?: string;
  npmUsername?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: Date;
  updatedAt: Date;
  role?: string;
}

export interface LibrarySearchResult {
  libraries: Library[];
  total: number;
  facets: {
    tags: Array<{ name: string; count: number }>;
    languages: Array<{ name: string; count: number }>;
    licenses: Array<{ name: string; count: number }>;
  };
  suggestions?: string[];
}

export interface LibrarySearchQuery {
  q?: string | undefined;
  tags?: string[] | undefined;
  language?: string | undefined;
  license?: string | undefined;
  status?: string | undefined;
  sort?: 'relevance' | 'popularity' | 'quality' | 'updated' | 'downloads' | undefined;
  order?: 'asc' | 'desc' | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface LibraryIndexData {
  name?: string;
  displayName?: string;
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
  status?: 'active' | 'deprecated' | 'archived';
  qualityScore?: number;
  popularityScore?: number;
  maintenanceScore?: number;
  lastUpdatedAt?: Date;
  lastCrawledAt?: Date;
}

export interface NpmPackageData {
  name: string;
  description?: string;
  version: string;
  license?: string;
  homepage?: string;
  repository?: {
    type?: string;
    url?: string;
  };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  types?: string;
  tsconfig?: any;
  readme?: string;
  modified?: string;
  downloads?: number;
  weeklyDownloads?: number;
  deprecated?: boolean;
  'dist-tags'?: {
    latest?: string;
  };
}

export interface GitHubRepoData {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language?: string;
  archived?: boolean;
  pushed_at?: string;
  updated_at?: string;
  created_at?: string;
  has_ci?: boolean;
  contributors_count?: number;
}
