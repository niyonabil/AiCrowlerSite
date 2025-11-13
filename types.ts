
export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface Link {
  url: string;
  anchor: string;
}

export interface CrawledPage {
  url:string;
  status: number;
  title: string;
  description: string;
  h1: string;
  contentPreview: string;
  internalLinks: number;
  externalLinks: number;
  metaTags: MetaTag[];
  internalLinkUrls?: Link[];
  externalLinkUrls?: Link[];
}

export interface CrawlSummary {
  totalPages: number;
  healthyPages: number;
  redirects: number;
  clientErrors: number;
  serverErrors: number;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

export interface SitemapSummary {
    totalUrls: number;
    hasLastmod: number;
    averagePriority: number;
    changeFreqDistribution: Record<string, number>;
}

export interface RobotsTxtRule {
  userAgent: string;
  type: 'Allow' | 'Disallow';
  path: string;
}

export interface RobotsTxtAnalysis {
  rules: RobotsTxtRule[];
  sitemaps: string[];
}

export interface AdsTxtRecord {
  domain: string;
  publisherId: string;
  relationship: 'DIRECT' | 'RESELLER' | string;
  tagId?: string;
}

export interface AdsTxtAnalysis {
  records: AdsTxtRecord[];
  malformedLines: string[];
}

export interface ApiKeys {
    gemini: string;
    openAI: string;
    openRouter: string;
    googleIndexing: string;
    indexNow: string;
    googleClientId: string;
    stripePublicKey: string;
    stripeSecretKey: string;
    paypalClientId: string;
    paypalClientSecret: string;
}

export interface PaymentMethod {
    id: string; 
    type: 'card' | 'paypal' | 'bank';
    display: string; 
    isDefault: boolean;
}

export interface Invoice {
    id?: number;
    user_id: string;
    date: string;
    amount: string;
    status: 'paid' | 'pending' | 'failed';
    pdf_url: string;
}

// User profile data, stored in public.users table
export interface UserProfile {
  id: string; // UUID from auth.users
  name: string;
  email: string;
  picture: string;
  plan: 'free' | 'pro' | 'business';
  plan_expiry: string | null;
  api_keys: ApiKeys;
  payment_methods: PaymentMethod[];
  role: 'admin' | 'user';
}


export interface AIAgent {
  id?: number;
  user_id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'openrouter';
  model: string;
  system_prompt: string;
  is_default?: boolean;
}

export interface Property {
  id?: number;
  user_id: string;
  url: string;
}

export interface AuditResultCache {
    id?: number;
    user_id: string;
    property_id: number;
    agent_id?: number;
    crawled_data: CrawledPage[];
    crawl_summary: CrawlSummary | null;
    robots_txt_data: RobotsTxtAnalysis | null;
    sitemap_data?: SitemapEntry[] | null;
    sitemap_summary?: SitemapSummary | null;
    ads_txt_data?: AdsTxtAnalysis | null;
    timestamp: string; // Changed to string for timestamptz
    analysis_mode: 'crawl' | 'sitemap' | 'robots' | 'ads';
}

export interface Settings {
    id?: number;
    default_api_keys: ApiKeys;
    adsense_script?: string;
    bank_details?: string;
}

export interface Post {
    id?: number;
    author_id: string;
    title: string;
    slug: string;
    content: string;
    created_at: string;
    updated_at: string;
    status: 'published' | 'draft';
}

export type Plan = 'free' | 'pro' | 'business';

export interface Order {
  id?: number;
  user_id: string;
  plan_id: Plan;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  payment_method: 'stripe' | 'paypal' | 'bank_transfer';
  provider_payment_id?: string;
  payment_proof_url?: string;
  created_at: string;
}


// FIX: Export User as an alias for UserProfile to resolve import errors across the application.
export type User = UserProfile;