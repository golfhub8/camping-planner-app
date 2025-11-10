import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLinkIcon, FileTextIcon, GamepadIcon, BookOpenIcon, DownloadIcon, LockIcon, CheckCircle2Icon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface AccessResponse {
  hasAccess: boolean;
  accessType?: 'pro';
  message: string;
  expiresAt?: Date;
}

interface Download {
  id: string;
  title: string;
  description: string;
  downloadUrl: string;
}

interface DownloadsResponse {
  downloads: Download[];
}

export default function Printables() {
  // Check if user has access to printables
  const { data: accessData, isLoading: accessLoading } = useQuery<AccessResponse>({
    queryKey: ['/api/printables/access'],
  });

  // Get download links if user has access
  const { data: downloadsData, isLoading: downloadsLoading } = useQuery<DownloadsResponse>({
    queryKey: ['/api/printables/downloads'],
    enabled: accessData?.hasAccess === true,
  });

  const hasAccess = accessData?.hasAccess;
  const downloads = downloadsData?.downloads || [];
  const isLoading = accessLoading || (hasAccess && downloadsLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-5xl">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4" data-testid="text-page-title">
            Printables & Games
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Enhance your camping experience with our collection of printable planners, activity books, and games
          </p>
          
          {/* Access Status Badge */}
          {accessData && (
            <div className="mt-4 flex justify-center">
              {hasAccess ? (
                <Badge variant="default" className="text-sm px-4 py-1" data-testid="badge-access-status">
                  <CheckCircle2Icon className="w-4 h-4 mr-2" />
                  Pro Member
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-sm px-4 py-1" data-testid="badge-no-access">
                  <LockIcon className="w-4 h-4 mr-2" />
                  Not a Pro Member
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* No Access - Show Upgrade Prompt */}
        {!hasAccess && (
          <Alert className="mb-8" data-testid="alert-upgrade-required">
            <LockIcon className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">{accessData?.message}</p>
              <p className="text-sm text-muted-foreground mb-4">
                Become a Pro member to access all printables. Start with a 7-day free trial!
              </p>
              <Button asChild size="sm" data-testid="button-start-trial">
                <Link href="/subscribe">
                  Start 7-Day Free Trial ($29.99/year)
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Product/Download Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(hasAccess ? downloads : []).map((download: any, index: number) => {
            const icons: Record<string, any> = {
              'camping-planner': FileTextIcon,
              'activity-book': BookOpenIcon,
              'games-bundle': GamepadIcon,
            };
            const Icon = icons[download.id] || FileTextIcon;
            
            return (
              <Card key={download.id} className="flex flex-col" data-testid={`card-download-${index}`}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-xl" data-testid={`text-download-title-${index}`}>
                    {download.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {download.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button
                    asChild
                    className="w-full"
                    data-testid={`button-download-${index}`}
                  >
                    <a
                      href={download.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Download PDF
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            All products are available as instant digital downloads
          </p>
        </div>
      </main>
    </div>
  );
}
