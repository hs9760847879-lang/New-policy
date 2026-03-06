'use client';

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  Key,
  Globe,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  Cpu,
  ShieldCheck,
  CreditCard,
  FileX,
  Info,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Types
interface ExtractedPolicy {
  name: string;
  found: boolean;
  summary: string;
  details: string;
  conditions?: string[];
  refoundText?: string;
}

interface ExtractionResult {
  cancellationPolicies: ExtractedPolicy[];
  paymentPolicies: ExtractedPolicy[];
  generalTerms?: string;
  companyName?: string;
  lastUpdated?: string;
  modelUsed: string;
  attempts: number;
}

interface ScrapedContent {
  title: string;
  contentLength: number;
  pagesScraped: number;
}

interface ExtractionResponse {
  success: boolean;
  result?: ExtractionResult;
  scrapedContent?: ScrapedContent;
  error?: string;
}

// Policy categories
const CANCELLATION_POLICIES = [
  'Cooling Off Period',
  'No Visa No Pay',
  'No Place No Pay',
  'Covid-19 Policy',
  'University Course Cancellation/Modification',
  'Early Termination by Students',
  'Delayed Arrivals & Travel Restrictions',
  'Replacement Tenant Found',
  'Deferring Studies',
  'University Intake Delayed',
  'No Questions Asked',
  'Extenuating Circumstances',
  'Other Cancellation Policies',
] as const;

const PAYMENT_POLICIES = [
  'Booking Deposit',
  'Security Deposit',
  'Payment Installment Plan',
  'Mode Of Payment',
  'Guarantor Requirement',
  'Fully Refundable Holding Fee',
  'Platform Fee',
  'Additional Fees',
] as const;

export default function PolicyExtractionDashboard() {
  // State
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [scrapedInfo, setScrapedInfo] = useState<ScrapedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('cancellation');

  // Memoized derived values
  const foundCancellation = useMemo(() => 
    result?.cancellationPolicies.filter(p => p.found).length || 0, 
    [result?.cancellationPolicies]
  );
  
  const foundPayment = useMemo(() => 
    result?.paymentPolicies.filter(p => p.found).length || 0, 
    [result?.paymentPolicies]
  );

  // Handle extraction
  const handleExtract = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Please enter a website URL');
      return;
    }
    if (!apiKey.trim()) {
      toast.error('Please enter your Gemini API key');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setScrapedInfo(null);
    setProgress(0);

    try {
      setProgress(10);
      setProgressMessage('Initializing scraper...');

      await new Promise(r => setTimeout(r, 500));
      setProgress(20);
      setProgressMessage('Connecting to website...');

      const response = await fetch('/api/extract-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, apiKey }),
      });

      setProgress(60);
      setProgressMessage('Analyzing content with AI...');

      const data: ExtractionResponse = await response.json();

      setProgress(90);
      setProgressMessage('Processing results...');

      if (data.success && data.result) {
        setResult(data.result);
        setScrapedInfo(data.scrapedContent || null);
        setProgress(100);
        setProgressMessage('Extraction complete!');

        toast.success(`Successfully extracted policies using ${data.result.modelUsed}`);
      } else {
        setError(data.error || 'Failed to extract policies');
        toast.error(data.error || 'Failed to extract policies');
      }
    } catch (err) {
      const errorMsg = (err as Error).message || 'An unexpected error occurred';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [url, apiKey]);

  // Export handlers
  const handleExportJSON = useCallback(() => {
    if (!result) return;
    
    const today = new Date().toISOString().split('T')[0];
    const exportData = {
      companyName: result.companyName,
      lastUpdated: result.lastUpdated,
      extractionDate: new Date().toISOString(),
      modelUsed: result.modelUsed,
      cancellationPolicies: result.cancellationPolicies,
      paymentPolicies: result.paymentPolicies,
      generalTerms: result.generalTerms,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `policies-${result.companyName || 'extract'}-${today}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    toast.success('JSON file downloaded');
  }, [result]);

  const handleExportCSV = useCallback(() => {
    if (!result) return;
    
    const today = new Date().toISOString().split('T')[0];
    const headers = ['Category', 'Policy Name', 'Found', 'Summary', 'Details', 'Conditions'];
    const rows: string[][] = [];

    result.cancellationPolicies.forEach(p => {
      rows.push([
        'Cancellation',
        p.name,
        p.found ? 'Yes' : 'No',
        `"${p.summary.replace(/"/g, '""')}"`,
        `"${p.details.replace(/"/g, '""')}"`,
        `"${(p.conditions || []).join('; ').replace(/"/g, '""')}"`,
      ]);
    });

    result.paymentPolicies.forEach(p => {
      rows.push([
        'Payment',
        p.name,
        p.found ? 'Yes' : 'No',
        `"${p.summary.replace(/"/g, '""')}"`,
        `"${p.details.replace(/"/g, '""')}"`,
        `"${(p.conditions || []).join('; ').replace(/"/g, '""')}"`,
      ]);
    });

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `policies-${result.companyName || 'extract'}-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    toast.success('CSV file downloaded');
  }, [result]);

  const handleExportPDF = useCallback(async () => {
    if (!result) return;

    toast.info('Generating PDF report...');

    try {
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, url, scrapedInfo }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        const today = new Date().toISOString().split('T')[0];
        link.download = `policy-report-${result.companyName || 'extract'}-${today}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        toast.success('PDF report downloaded');
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch {
      toast.error('Failed to generate PDF');
    }
  }, [result, url, scrapedInfo]);

  const handleExportExcel = useCallback(async () => {
    if (!result) return;

    toast.info('Generating Excel report...');

    try {
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, url, scrapedInfo }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        const today = new Date().toISOString().split('T')[0];
        link.download = `policy-report-${result.companyName || 'extract'}-${today}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
        toast.success('Excel report downloaded');
      } else {
        toast.error('Failed to generate Excel');
      }
    } catch {
      toast.error('Failed to generate Excel');
    }
  }, [result, url, scrapedInfo]);

  const handleReset = useCallback(() => {
    setUrl('');
    setApiKey('');
    setResult(null);
    setScrapedInfo(null);
    setError(null);
    setProgress(0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Policy Extractor</h1>
                <p className="text-xs text-slate-400">Student Accommodation Policy Analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-slate-300 border-slate-600">
                <Cpu className="h-3 w-3 mr-1" />
                Gemini AI Powered
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8">
          {/* Input Section */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                Website Configuration
              </CardTitle>
              <CardDescription className="text-slate-400">
                Enter the student accommodation website URL and your Gemini API key to extract policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://www.example-accommodation.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Gemini API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter your Gemini API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Progress Bar */}
              {isLoading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{progressMessage}</span>
                    <span className="text-blue-400">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-slate-700" />
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-800/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleExtract}
                  disabled={isLoading || !url.trim() || !apiKey.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Extract Policies
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {result && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-500/20 rounded-lg">
                        <Building2 className="h-6 w-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Company</p>
                        <p className="text-lg font-semibold text-white truncate max-w-[150px]">
                          {result.companyName || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-500/20 rounded-lg">
                        <FileText className="h-6 w-6 text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Cancellation Policies</p>
                        <p className="text-lg font-semibold text-white">
                          {foundCancellation}/{CANCELLATION_POLICIES.length} Found
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500/20 rounded-lg">
                        <CreditCard className="h-6 w-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Payment Policies</p>
                        <p className="text-lg font-semibold text-white">
                          {foundPayment}/{PAYMENT_POLICIES.length} Found
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-500/20 rounded-lg">
                        <Cpu className="h-6 w-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-400">Model Used</p>
                        <p className="text-lg font-semibold text-white">
                          {result.modelUsed}
                        </p>
                        <p className="text-xs text-slate-500">
                          {result.attempts} attempt(s)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Export Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleExportJSON}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button
                  onClick={handleExportExcel}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>

              {/* Scraping Info */}
              {scrapedInfo && (
                <Alert className="bg-slate-800/30 border-slate-700/50">
                  <Info className="h-4 w-4 text-blue-400" />
                  <AlertTitle className="text-slate-300">Scraping Details</AlertTitle>
                  <AlertDescription className="text-slate-400">
                    Scraped <strong>{scrapedInfo.contentLength.toLocaleString()}</strong> characters
                    from <strong>{scrapedInfo.title}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {/* Policy Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-800/50 border border-slate-700/50">
                  <TabsTrigger
                    value="cancellation"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400"
                  >
                    <FileX className="h-4 w-4 mr-2" />
                    Cancellation ({foundCancellation}/{CANCELLATION_POLICIES.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="payment"
                    className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-slate-400"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payment ({foundPayment}/{PAYMENT_POLICIES.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="overview"
                    className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-400"
                  >
                    <Info className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                </TabsList>

                {/* Cancellation Policies Tab */}
                <TabsContent value="cancellation" className="mt-6">
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <FileX className="h-5 w-5 text-red-400" />
                        Cancellation Policies
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Policies related to booking cancellations and terminations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[600px] pr-4">
                        <Accordion type="multiple" className="space-y-2">
                          {result.cancellationPolicies.map((policy, index) => (
                            <AccordionItem
                              key={`cancel-${index}`}
                              value={`cancel-${index}`}
                              className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-4"
                            >
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3">
                                  {policy.found ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-slate-500" />
                                  )}
                                  <span className="text-white font-medium">{policy.name}</span>
                                  {policy.found && (
                                    <Badge className="bg-green-600/20 text-green-400 border-green-600/50">
                                      Found
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="text-slate-300">
                                {policy.found ? (
                                  <div className="space-y-3 pt-2">
                                    <div>
                                      <h4 className="text-sm font-semibold text-blue-400 mb-1">Summary</h4>
                                      <p className="text-sm">{policy.summary || 'No summary available'}</p>
                                    </div>
                                    {policy.details && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-purple-400 mb-1">Details</h4>
                                        <p className="text-sm whitespace-pre-wrap">{policy.details}</p>
                                      </div>
                                    )}
                                    {policy.conditions && policy.conditions.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-amber-400 mb-1">Conditions</h4>
                                        <ul className="list-disc list-inside text-sm space-y-1">
                                          {policy.conditions.map((cond, i) => (
                                            <li key={i}>{cond}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {policy.refoundText && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-slate-400 mb-1">Original Text</h4>
                                        <p className="text-xs bg-slate-800/50 p-2 rounded italic text-slate-400">
                                          &quot;{policy.refoundText}&quot;
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-500 py-2">
                                    <Info className="h-4 w-4" />
                                    <span className="text-sm">
                                      This policy was not explicitly found on the website.
                                    </span>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Payment Policies Tab */}
                <TabsContent value="payment" className="mt-6">
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-purple-400" />
                        Payment Policies
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Policies related to deposits, fees, and payment methods
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[600px] pr-4">
                        <Accordion type="multiple" className="space-y-2">
                          {result.paymentPolicies.map((policy, index) => (
                            <AccordionItem
                              key={`payment-${index}`}
                              value={`payment-${index}`}
                              className="bg-slate-900/50 border border-slate-700/50 rounded-lg px-4"
                            >
                              <AccordionTrigger className="hover:no-underline">
                                <div className="flex items-center gap-3">
                                  {policy.found ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                                  ) : (
                                    <XCircle className="h-5 w-5 text-slate-500" />
                                  )}
                                  <span className="text-white font-medium">{policy.name}</span>
                                  {policy.found && (
                                    <Badge className="bg-green-600/20 text-green-400 border-green-600/50">
                                      Found
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="text-slate-300">
                                {policy.found ? (
                                  <div className="space-y-3 pt-2">
                                    <div>
                                      <h4 className="text-sm font-semibold text-blue-400 mb-1">Summary</h4>
                                      <p className="text-sm">{policy.summary || 'No summary available'}</p>
                                    </div>
                                    {policy.details && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-purple-400 mb-1">Details</h4>
                                        <p className="text-sm whitespace-pre-wrap">{policy.details}</p>
                                      </div>
                                    )}
                                    {policy.conditions && policy.conditions.length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-amber-400 mb-1">Conditions</h4>
                                        <ul className="list-disc list-inside text-sm space-y-1">
                                          {policy.conditions.map((cond, i) => (
                                            <li key={i}>{cond}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {policy.refoundText && (
                                      <div>
                                        <h4 className="text-sm font-semibold text-slate-400 mb-1">Original Text</h4>
                                        <p className="text-xs bg-slate-800/50 p-2 rounded italic text-slate-400">
                                          &quot;{policy.refoundText}&quot;
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-500 py-2">
                                    <Info className="h-4 w-4" />
                                    <span className="text-sm">
                                      This policy was not explicitly found on the website.
                                    </span>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Overview Tab */}
                <TabsContent value="overview" className="mt-6">
                  <div className="grid gap-6">
                    <Card className="bg-slate-800/50 border-slate-700/50">
                      <CardHeader>
                        <CardTitle className="text-white">Extraction Statistics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-400">Cancellation Policies</h4>
                            <div className="space-y-2">
                              {result.cancellationPolicies.map((policy) => (
                                <div key={policy.name} className="flex items-center gap-2">
                                  {policy.found ? (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-slate-500" />
                                  )}
                                  <span className={`text-sm ${policy.found ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {policy.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-400">Payment Policies</h4>
                            <div className="space-y-2">
                              {result.paymentPolicies.map((policy) => (
                                <div key={policy.name} className="flex items-center gap-2">
                                  {policy.found ? (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-slate-500" />
                                  )}
                                  <span className={`text-sm ${policy.found ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {policy.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {result.generalTerms && (
                      <Card className="bg-slate-800/50 border-slate-700/50">
                        <CardHeader>
                          <CardTitle className="text-white">General Terms</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-slate-300 whitespace-pre-wrap">{result.generalTerms}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}

          {/* Getting Started Guide */}
          {!result && !isLoading && (
            <Card className="bg-slate-800/30 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-400" />
                  Getting Started
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Badge className="bg-blue-600">1</Badge>
                      Enter Website URL
                    </h4>
                    <p className="text-sm text-slate-400">
                      Provide the URL of a student accommodation website. The system will automatically
                      scrape policy-related pages and extract content.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Badge className="bg-purple-600">2</Badge>
                      Provide Gemini API Key
                    </h4>
                    <p className="text-sm text-slate-400">
                      Get your API key from Google AI Studio. The system uses Gemini 3 Flash,
                      with automatic fallback to Gemini 2.5 Flash and 2.5 Flash Lite.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Badge className="bg-green-600">3</Badge>
                      Extract Policies
                    </h4>
                    <p className="text-sm text-slate-400">
                      Click &quot;Extract Policies&quot; to start the extraction process. The system will
                      scrape the website and use AI to identify and extract relevant policies.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-white flex items-center gap-2">
                      <Badge className="bg-amber-600">4</Badge>
                      Review &amp; Export
                    </h4>
                    <p className="text-sm text-slate-400">
                      Review the extracted policies in the interactive dashboard and export
                      results in JSON, CSV, PDF, or Excel format.
                    </p>
                  </div>
                </div>

                <Separator className="bg-slate-700" />

                <div className="space-y-2">
                  <h4 className="font-semibold text-white">Policies to Extract</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-slate-400">Cancellation:</span>
                    {CANCELLATION_POLICIES.map((policy) => (
                      <Badge key={policy} variant="outline" className="text-xs border-slate-600 text-slate-400">
                        {policy}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-slate-400">Payment:</span>
                    {PAYMENT_POLICIES.map((policy) => (
                      <Badge key={policy} variant="outline" className="text-xs border-slate-600 text-slate-400">
                        {policy}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Policy Extractor Dashboard</span>
            <span>Powered by Playwright &amp; Gemini AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
