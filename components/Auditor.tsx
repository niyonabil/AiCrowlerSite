import React, { useState, useCallback, useEffect } from 'react';
import { CrawledPage, CrawlSummary, RobotsTxtAnalysis, Property, AuditResultCache, UserProfile, SitemapEntry, SitemapSummary, AIAgent, AdsTxtAnalysis } from '../types';
import { fetchAllUrlsFromSitemaps, discoverUrlsToCrawl, analyzePageBatch, analyzeRobotsTxt, analyzeAdsTxt } from '../services/aiService';
import { submitToIndexNow } from '../services/indexingService';
import { submitUrlsToGoogle } from '../services/googleService';
import { UrlInputForm } from './UrlInputForm';
import { SummaryMetrics } from './SummaryMetrics';
import { ResultsTable } from './ResultsTable';
import { ArrowLeftIcon, CpuChipIcon, PaperAirplaneIcon, SpinnerIcon, GoogleIcon } from './icons';
import { AnalysisModeSelector } from './AnalysisModeSelector';
import { RobotsTxtDisplay } from './RobotsTxtDisplay';
import { SitemapSummaryMetrics } from './SitemapSummaryMetrics';
import { SitemapTable } from './SitemapTable';
import { AdsTxtDisplay } from './AdsTxtDisplay';
import { AuditHistory } from './AuditHistory';
import { supabase } from '../services/supabase';
import { decrypt } from '../services/crypto';

const ANALYSIS_BATCH_SIZE = 3;

interface AuditorProps {
    property: Property;
    user: UserProfile;
    onBack: () => void;
    onSaveResults: (propertyId: number, results: Omit<AuditResultCache, 'property_id' | 'id'>) => Promise<void>;
    cachedResults: AuditResultCache | null;
}

export const Auditor: React.FC<AuditorProps> = ({ property, user, onBack, onSaveResults, cachedResults }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'crawl' | 'sitemap' | 'robots' | 'ads'>('crawl');
  const [crawlDepth, setCrawlDepth] = useState<number>(3);
  
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Preparing for live analysis...");
  
  const [crawledData, setCrawledData] = useState<CrawledPage[]>([]);
  const [crawlSummary, setCrawlSummary] = useState<CrawlSummary | null>(null);
  const [robotsTxtData, setRobotsTxtData] = useState<RobotsTxtAnalysis | null>(null);
  const [sitemapData, setSitemapData] = useState<SitemapEntry[]>([]);
  const [sitemapSummary, setSitemapSummary] = useState<SitemapSummary | null>(null);
  const [adsTxtData, setAdsTxtData] = useState<AdsTxtAnalysis | null>(null);
  
  const [viewingAudit, setViewingAudit] = useState<AuditResultCache | null>(null);

  const [indexNowSubmitting, setIndexNowSubmitting] = useState(false);
  const [indexNowStatus, setIndexNowStatus] = useState<{ success: boolean; message: string } | null>(null);
  
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleSubmissionProgress, setGoogleSubmissionProgress] = useState<{ submitted: number, total: number} | null>(null);
  const [googleStatus, setGoogleStatus] = useState<{ success: boolean; message: string } | null>(null);

  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>();
  const [urlToAnalyze, setUrlToAnalyze] = useState<string>(property.url);
  
  const isViewingLatest = cachedResults?.id === viewingAudit?.id;
  const isUrlModified = urlToAnalyze !== property.url;

  useEffect(() => {
    const fetchData = async () => {
        const { data: agentData } = await supabase.from('agents').select('*').eq('user_id', user.id);
        if (agentData) setAgents(agentData);
        
        const { data: settingsData } = await supabase.from('settings').select('*').limit(1).single();
        if (settingsData) setSettings(settingsData);
    };
    fetchData();
  }, [user.id]);

  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgentId) {
        const defaultAgent = agents.find(a => a.is_default) || agents[0];
        setSelectedAgentId(defaultAgent.id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    setViewingAudit(cachedResults);
  }, [cachedResults]);
  
  useEffect(() => {
    if (viewingAudit) {
        setCrawledData(viewingAudit.crawled_data || []);
        setCrawlSummary(viewingAudit.crawl_summary || null);
        setRobotsTxtData(viewingAudit.robots_txt_data || null);
        setSitemapData(viewingAudit.sitemap_data || []);
        setSitemapSummary(viewingAudit.sitemap_summary || null);
        setAdsTxtData(viewingAudit.ads_txt_data || null);
    } else {
        setCrawledData([]);
        setCrawlSummary(null);
        setRobotsTxtData(null);
        setSitemapData([]);
        setSitemapSummary(null);
        setAdsTxtData(null);
    }
  }, [viewingAudit]);

  const calculateCrawlSummary = (pages: CrawledPage[]): CrawlSummary => {
    return pages.reduce((acc, page) => {
      acc.totalPages += 1;
      if (page.status >= 200 && page.status < 300) acc.healthyPages += 1;
      else if (page.status >= 300 && page.status < 400) acc.redirects += 1;
      else if (page.status >= 400 && page.status < 500) acc.clientErrors += 1;
      else if (page.status >= 500) acc.serverErrors += 1;
      return acc;
    }, { totalPages: 0, healthyPages: 0, redirects: 0, clientErrors: 0, serverErrors: 0 });
  };
  
  const calculateSitemapSummary = (entries: SitemapEntry[]): SitemapSummary => {
      if (entries.length === 0) {
          return { totalUrls: 0, hasLastmod: 0, averagePriority: 0, changeFreqDistribution: {} };
      }
      const totalUrls = entries.length;
      const hasLastmod = entries.filter(e => e.lastmod).length;
      const totalPriority = entries.reduce((sum, e) => sum + (e.priority || 0), 0);
      const averagePriority = totalUrls > 0 ? totalPriority / totalUrls : 0;
      const changeFreqDistribution = entries.reduce((acc, e) => {
          const freq = e.changefreq || 'not set';
          acc[freq] = (acc[freq] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);

      return { totalUrls, hasLastmod, averagePriority, changeFreqDistribution };
  };
  
  const handleAnalysis = useCallback(async () => {
    if (!property.id || !selectedAgentId || !agents || !user.id) return;

    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    if (!selectedAgent) {
        setError("Please select a valid AI Agent.");
        return;
    }

    let apiKey = '';
    let isUsingDefaultKey = false;
    
    const userApiKey = user.api_keys?.[selectedAgent.provider];
    if (userApiKey) apiKey = decrypt(userApiKey);

    if (!apiKey) {
        const defaultApiKey = settings?.default_api_keys?.[selectedAgent.provider];
        if (defaultApiKey) {
            apiKey = decrypt(defaultApiKey);
            isUsingDefaultKey = true;
        }
    }
    
    if (isUsingDefaultKey) {
        const trialExpired = user.plan_expiry ? new Date() > new Date(user.plan_expiry) : true;
        if (trialExpired) {
             setError(`Your trial has expired. To continue using the shared API key, please upgrade your plan. Alternatively, you can add your own personal API key in Settings to continue auditing.`);
             return;
        }
    }

    if (!apiKey) {
        const providerName = selectedAgent.provider.charAt(0).toUpperCase() + selectedAgent.provider.slice(1);
        setError(`No personal or default API key found for ${providerName}. Please add your key in Settings, or ask the administrator to configure a default key.`);
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setViewingAudit(null);
    setIndexNowStatus(null);
    setGoogleStatus(null);
    setGoogleSubmissionProgress(null);
    setProgress(0);
    setLoadingMessage("Preparing for live analysis...");
    
    let finalCrawledData: CrawledPage[] = [];
    let finalRobotsData: RobotsTxtAnalysis | null = null;
    let finalSitemapData: SitemapEntry[] | null = null;
    let finalAdsTxtData: AdsTxtAnalysis | null = null;

    try {
        if (analysisMode === 'sitemap') {
            setLoadingMessage("Finding and parsing all sitemaps...");
            setProgress(25);
            finalSitemapData = await fetchAllUrlsFromSitemaps(urlToAnalyze, selectedAgent, apiKey);
            if (!finalSitemapData || finalSitemapData.length === 0) {
                throw new Error("The AI could not find or parse any sitemaps. Check the URL or try Deep Crawl mode.");
            }
            setProgress(100); setLoadingMessage("Sitemap analysis complete!");

        } else if (analysisMode === 'robots') {
            setLoadingMessage("Analyzing robots.txt file...");
            setProgress(50);
            finalRobotsData = await analyzeRobotsTxt(urlToAnalyze, selectedAgent, apiKey);
            setProgress(100); setLoadingMessage("Analysis complete!");
        } else if (analysisMode === 'ads') {
            setLoadingMessage("Analyzing ads.txt file...");
            setProgress(50);
            finalAdsTxtData = await analyzeAdsTxt(urlToAnalyze, selectedAgent, apiKey);
            setProgress(100); setLoadingMessage("Analysis complete!");
        } else {
            setLoadingMessage("Discovering pages to crawl...");
            const allUrls = await discoverUrlsToCrawl(urlToAnalyze, crawlDepth);
            if (!allUrls || allUrls.length === 0) {
                throw new Error("Could not find any internal URLs. Check the URL and ensure the site is accessible.");
            }
            
            for (let i = 0; i < allUrls.length; i += ANALYSIS_BATCH_SIZE) {
              const batch = allUrls.slice(i, i + ANALYSIS_BATCH_SIZE);
              setLoadingMessage(`Analyzing pages ${i + 1}-${Math.min(i + ANALYSIS_BATCH_SIZE, allUrls.length)} of ${allUrls.length}...`);
              
              const batchResults = await analyzePageBatch(batch, selectedAgent, apiKey);
              finalCrawledData.push(...batchResults);
              setCrawledData(prev => [...prev, ...batchResults]);
              setProgress(((i + batch.length) / allUrls.length) * 100);
            }
        }

        const auditResultData = {
            user_id: user.id,
            crawled_data: finalCrawledData,
            crawl_summary: finalCrawledData.length > 0 ? calculateCrawlSummary(finalCrawledData) : null,
            robots_txt_data: finalRobotsData,
            sitemap_data: finalSitemapData,
            sitemap_summary: finalSitemapData ? calculateSitemapSummary(finalSitemapData) : null,
            ads_txt_data: finalAdsTxtData,
            timestamp: new Date().toISOString(),
            analysis_mode: analysisMode,
            agent_id: selectedAgentId,
        };
        
        if (isUrlModified) {
            const transientAudit: AuditResultCache = {
                id: Date.now(), // Use timestamp for a unique key for this transient view
                property_id: property.id,
                ...auditResultData
            };
            setViewingAudit(transientAudit);
        } else {
            await onSaveResults(property.id, auditResultData);
        }
        
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [analysisMode, crawlDepth, property.url, property.id, onSaveResults, user, agents, selectedAgentId, settings, urlToAnalyze, isUrlModified]);
  
  const handleLoadAudit = (audit: AuditResultCache) => setViewingAudit(audit);
  
  const handleDeleteAudit = async (auditId: number) => {
      if (confirm('Are you sure you want to delete this audit record? This action cannot be undone.')) {
          const wasViewingDeleted = viewingAudit?.id === auditId;
          const { error } = await supabase.from('audit_results').delete().eq('id', auditId);
          if (error) {
              console.error("Failed to delete audit:", error);
              alert("Could not delete the audit record.");
              return;
          }
          if (wasViewingDeleted) {
              // Refetch the latest to update the view
               const { data } = await supabase.from('audit_results').select('*').eq('property_id', property.id!).order('timestamp', {ascending: false}).limit(1).single();
               setViewingAudit(data as AuditResultCache | null);
          }
      }
  };

  const handleSubmitToIndexNow = async () => {
    const indexNowApiKey = decrypt(user.api_keys.indexNow);
    if (!indexNowApiKey) {
        setIndexNowStatus({ success: false, message: "IndexNow API key is not configured in settings." }); return;
    }
    setIndexNowSubmitting(true);
    setIndexNowStatus(null);
    try {
        const healthyUrls = (viewingAudit?.crawled_data || []).filter(p => p.status >= 200 && p.status < 300).map(p => p.url);
        if (healthyUrls.length === 0) throw new Error("No healthy (2xx) URLs found in this audit to submit.");
        await submitToIndexNow(healthyUrls, indexNowApiKey, property.url);
        setIndexNowStatus({ success: true, message: `Successfully submitted ${healthyUrls.length} URLs to IndexNow.` });
    } catch (err) {
        setIndexNowStatus({ success: false, message: err instanceof Error ? err.message : "An unknown submission error occurred." });
    } finally { setIndexNowSubmitting(false); }
  };
  
  const handleSubmitToGoogle = async () => {
    const googleClientId = decrypt(user.api_keys.googleClientId);
    if (!googleClientId) {
        setGoogleStatus({ success: false, message: "Google Client ID is not configured in settings." }); return;
    }
    setGoogleSubmitting(true);
    setGoogleStatus(null);
    setGoogleSubmissionProgress(null);
    try {
        const healthyUrls = (viewingAudit?.crawled_data || []).filter(p => p.status >= 200 && p.status < 300).map(p => p.url);
        if (healthyUrls.length === 0) throw new Error("No healthy (2xx) URLs found in this audit to submit.");
        
        const onProgress = (submitted: number, total: number) => {
            setGoogleSubmissionProgress({ submitted, total });
        };

        const result = await submitUrlsToGoogle(healthyUrls, googleClientId, onProgress);
        setGoogleStatus({ success: true, message: `Submission complete. Success: ${result.success}, Failed: ${result.failed}.` });
        
    } catch (err) {
        setGoogleStatus({ success: false, message: err instanceof Error ? err.message : "An unknown submission error occurred." });
    } finally {
        setGoogleSubmitting(false);
    }
  };

  const renderResults = () => {
    if (!viewingAudit) return null;
    
    switch(viewingAudit.analysis_mode) {
      case 'crawl': return (<><SummaryMetrics summary={crawlSummary} /><ResultsTable pages={crawledData} /></>);
      case 'sitemap': return (<><SitemapSummaryMetrics summary={sitemapSummary} /><SitemapTable entries={sitemapData} /></>);
      case 'robots': return robotsTxtData ? <RobotsTxtDisplay data={robotsTxtData} /> : <p className="text-center text-slate-400 mt-8">No robots.txt data found.</p>;
      case 'ads': return adsTxtData ? <AdsTxtDisplay data={adsTxtData} /> : <p className="text-center text-slate-400 mt-8">No ads.txt data found.</p>;
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="flex items-center text-sm font-semibold text-slate-300 hover:text-white">
              <ArrowLeftIcon className="w-5 h-5 mr-2" /> Back to Properties
          </button>
      </div>

      <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-100 truncate">{property.url}</h1>
          <p className="mt-2 text-lg text-slate-400">Select an analysis mode and start your audit.</p>
      </div>
      
       <div className="mb-6 flex justify-center items-center gap-4">
          <label htmlFor="agent-select" className="text-slate-400 text-sm font-medium whitespace-nowrap flex items-center gap-2"><CpuChipIcon className="w-5 h-5"/> AI Agent:</label>
          <select id="agent-select" value={selectedAgentId} onChange={e => setSelectedAgentId(Number(e.target.value))} className="bg-slate-700 text-cyan-400 font-bold text-sm rounded-md appearance-none cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 py-2 pl-4 pr-8">
              {agents?.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
       </div>

      <UrlInputForm onSubmit={handleAnalysis} isLoading={isLoading} propertyUrl={urlToAnalyze} onUrlChange={setUrlToAnalyze} analysisMode={analysisMode} crawlDepth={crawlDepth} onCrawlDepthChange={setCrawlDepth} />
      {isUrlModified && (
        <p className="text-center text-sm text-yellow-400 mt-4 max-w-2xl mx-auto">
            Note: You are analyzing a different URL. Results for this audit will be displayed but not saved to this property's history.
        </p>
      )}
      <div className="my-8"><AnalysisModeSelector mode={analysisMode} setMode={setAnalysisMode}/></div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <main className="lg:col-span-3">
          {viewingAudit && !isViewingLatest && (
             <div className="mb-6 bg-slate-700/50 border border-blue-500 rounded-lg p-4 flex justify-between items-center">
                <p className="text-sm text-blue-300">
                    You are viewing a historical audit from {new Date(viewingAudit.timestamp).toLocaleString()}.
                </p>
                <button onClick={() => setViewingAudit(cachedResults)} className="text-sm font-semibold text-cyan-400 hover:underline">
                    View Latest Audit
                </button>
             </div>
          )}

          {isLoading ? (
            <div className="text-center p-8 bg-slate-800 rounded-lg">
                <SpinnerIcon className="w-8 h-8 mx-auto animate-spin text-cyan-400" />
                <p className="mt-4 font-semibold text-slate-200">{loadingMessage}</p>
                <div className="w-full bg-slate-700 rounded-full h-2.5 mt-4">
                  <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.5s ease-in-out' }}></div>
                </div>
            </div>
          ) : error ? (
             <div className="text-center p-8 bg-red-900/50 border border-red-700 rounded-lg" role="alert">
               <h3 className="text-xl font-bold text-red-400">Analysis Failed</h3>
               <p className="mt-2 text-red-300">{error}</p>
             </div>
          ) : (viewingAudit || cachedResults) ? (
            <>
              {renderResults()}
              {viewingAudit?.analysis_mode === 'crawl' && (viewingAudit?.crawled_data?.length || 0) > 0 && (
                <div className="mt-8 p-6 bg-slate-800 rounded-lg shadow-lg border border-slate-700">
                  <h3 className="text-xl font-bold mb-4">Indexing Submission</h3>
                  <p className="text-sm text-slate-400 mb-6">Submit all healthy (2xx status) URLs from this audit to search engines for faster discovery and indexing.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Google Submission */}
                      <div className="bg-slate-900/50 p-4 rounded-lg">
                          <h4 className="font-semibold text-slate-200 mb-3">Google Search Console</h4>
                          <button onClick={handleSubmitToGoogle} disabled={googleSubmitting} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors">
                            {googleSubmitting ? <><SpinnerIcon className="w-5 h-5 animate-spin"/>Submitting...</> : <><GoogleIcon className="w-5 h-5" />Submit to Google</>}
                          </button>
                           {googleSubmissionProgress && (
                               <div className="mt-3 text-center">
                                   <p className="text-sm text-slate-300">Submitting {googleSubmissionProgress.submitted} of {googleSubmissionProgress.total}...</p>
                                   <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1">
                                        <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${(googleSubmissionProgress.submitted / googleSubmissionProgress.total) * 100}%`}}></div>
                                    </div>
                               </div>
                           )}
                          {googleStatus && <p className={`mt-3 text-sm text-center whitespace-pre-wrap ${googleStatus.success ? 'text-green-400' : 'text-red-400'}`}>{googleStatus.message}</p>}
                      </div>

                      {/* IndexNow Submission */}
                      <div className="bg-slate-900/50 p-4 rounded-lg">
                          <h4 className="font-semibold text-slate-200 mb-3">IndexNow</h4>
                          <button onClick={handleSubmitToIndexNow} disabled={indexNowSubmitting} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors">
                            {indexNowSubmitting ? <><SpinnerIcon className="w-5 h-5 animate-spin"/>Submitting...</> : <><PaperAirplaneIcon className="w-5 h-5" />Submit to IndexNow</>}
                          </button>
                          {indexNowStatus && <p className={`mt-3 text-sm text-center ${indexNowStatus.success ? 'text-green-400' : 'text-red-400'}`}>{indexNowStatus.message}</p>}
                      </div>
                  </div>
                </div>
              )}
            </>
          ) : (
             <p className="text-center text-slate-400 mt-8">No analysis has been run for this property yet. Click "Analyze" to begin.</p>
          )}
        </main>
        
        <aside className="lg:col-span-1">
          <AuditHistory propertyId={property.id!} currentAuditId={viewingAudit?.id} onLoadAudit={handleLoadAudit} onDeleteAudit={handleDeleteAudit} />
        </aside>
      </div>
    </div>
  );
};