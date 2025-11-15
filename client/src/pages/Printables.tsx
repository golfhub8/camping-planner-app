import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FileTextIcon, GamepadIcon, BookOpenIcon, DownloadIcon, LockIcon, CheckCircle2Icon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import SubscribeButton from "../components/SubscribeButton";

interface Printable {
  id: string;
  title: string;
  description: string;
  file: string | null;
  free?: boolean;
  requiresPro?: boolean;
}

interface PrintablesResponse {
  printables: Printable[];
  user: { isPro: boolean } | null;
}

export default function Printables() {
  const { toast } = useToast();
  const [showPersonalUseModal, setShowPersonalUseModal] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; isPro: boolean; filename?: string } | null>(null);

  // Get all printables (free and Pro)
  const { data, isLoading } = useQuery<PrintablesResponse>({
    queryKey: ['/api/printables/downloads'],
  });

  // Check if Stripe is configured
  const { data: configData } = useQuery<{ configured: boolean }>({
    queryKey: ['/api/billing/config'],
    retry: false,
  });

  const printables = data?.printables || [];
  const isPro = data?.user?.isPro || false;
  const isStripeConfigured = configData?.configured !== false;

  // Mapping of printable IDs to actual PDF filenames for proper download naming
  const filenameMap: Record<string, string> = {
    'camping-planner-us': 'THE CAMPING PLANNER US LETTER.pdf',
    'camping-planner-a4': 'THE CAMPING PLANNER A4 SIZE.pdf',
    'ultimate-planner': 'THE ULTIMATE CAMPING PLANNER US LETTER.pdf',
    'games-bundle': 'CAMPING GAMES BUNDLE US LETTER.pdf',
    'mega-activity-book': 'MEGA CAMPING ACTIVITY BOOK A4.pdf',
  };

  // Handle download initiation - show personal use modal first (only for Pro files if not acknowledged in session)
  const initiateDownload = (url: string, isProFile: boolean, filename?: string) => {
    // Check if user has already acknowledged personal use agreement in this session
    const hasAcknowledged = typeof window !== 'undefined' && sessionStorage.getItem('personalUseAcknowledged') === 'true';
    
    // For Pro files, show modal if not acknowledged
    // For free files, proceed directly
    if (isProFile && !hasAcknowledged) {
      setPendingDownload({ url, isPro: isProFile, filename });
      setShowPersonalUseModal(true);
    } else {
      // Proceed directly with download
      handleDirectDownload(url, isProFile, filename);
    }
  };

  // Direct download without modal (for free files or after acknowledgement)
  const handleDirectDownload = async (url: string, isProFile: boolean, filename?: string) => {
    if (isProFile) {
      try {
        const response = await fetch(url, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 402) {
            toast({
              title: "Pro Membership Required",
              description: "This printable requires an active Pro membership. Please upgrade to access Pro content.",
              variant: "destructive",
            });
            return;
          }
          throw new Error('Download failed');
        }

        const blob = await response.blob();
        if (typeof window !== 'undefined') {
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename || 'printable.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
        }

        toast({
          title: "Download Started",
          description: "Your printable is downloading now.",
        });
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Please try again or contact support.",
          variant: "destructive",
        });
      }
    } else {
      // Free file - open in new tab to view directly
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
        toast({
          title: "Opening Printable",
          description: "Your free printable is opening in a new tab.",
        });
      } else {
        toast({
          title: "Unable to Open",
          description: "Please access this page in a browser to view printables.",
          variant: "destructive",
        });
      }
    }
  };

  // Handle confirmed download after user agrees to terms
  const handleConfirmedDownload = async () => {
    if (!pendingDownload) return;

    // Mark as acknowledged for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('personalUseAcknowledged', 'true');
    }
    
    setShowPersonalUseModal(false);
    
    // Proceed with download
    await handleDirectDownload(pendingDownload.url, pendingDownload.isPro, pendingDownload.filename);
    
    // Clear pending download
    setPendingDownload(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      
      <main className="container mx-auto pt-20 md:pt-24 px-4 md:px-10 py-6 md:py-12 max-w-6xl">
        {/* Configuration Warning Banner */}
        {!isStripeConfigured && (
          <Alert className="mb-6" data-testid="alert-stripe-not-configured">
            <AlertDescription>
              Payments not configured. Stripe checkout is unavailable until STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set.
            </AlertDescription>
          </Alert>
        )}

        {/* Page Header */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-3 md:mb-4" data-testid="text-page-title">
            Printables & Games
          </h1>
          <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Download free and Pro-exclusive printable resources for your next camping trip
          </p>
          
          {/* Pro Member Info */}
          {isPro && (
            <p className="text-sm text-muted-foreground mt-3">
              Your membership includes all current printables in this list.
            </p>
          )}
        </div>

        {/* Printables Grid */}
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8 md:mb-12">
          {printables.map((p, index) => {
            const icons: Record<string, any> = {
              'free-food-packing': FileTextIcon,
              'free-charades': GamepadIcon,
              'camping-planner-us': FileTextIcon,
              'camping-planner-a4': FileTextIcon,
              'ultimate-planner': BookOpenIcon,
              'games-bundle': GamepadIcon,
              'mega-activity-book': BookOpenIcon,
            };
            const Icon = icons[p.id] || FileTextIcon;

            return (
              <Card key={p.id} className="flex flex-col" data-testid={`card-printable-${index}`}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    {p.free && (
                      <Badge variant="secondary" className="text-xs">
                        Free
                      </Badge>
                    )}
                    {p.requiresPro && (
                      <Badge variant="default" className="text-xs">
                        Pro
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg" data-testid={`text-printable-title-${index}`}>
                    {p.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {p.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  {p.free && p.file ? (
                    // Free printables: Always show download for everyone
                    <Button
                      onClick={() => initiateDownload(p.file!, false)}
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                      data-testid={`button-download-${index}`}
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Download Free
                    </Button>
                  ) : p.requiresPro && isPro ? (
                    // Pro printables: Show download button for Pro members (uses protected endpoint)
                    <Button
                      onClick={() => initiateDownload(`/api/printables/download/${p.id}`, true, filenameMap[p.id])}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      data-testid={`button-download-${index}`}
                    >
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Download (Pro)
                    </Button>
                  ) : p.requiresPro && !isPro ? (
                    // Pro printables: Show locked message for non-Pro users
                    <div className="w-full text-center" data-testid={`locked-printable-${index}`}>
                      <p className="text-xs text-muted-foreground italic flex items-center justify-center gap-1 mb-2">
                        <LockIcon className="w-3 h-3" />
                        Available with Pro Membership
                      </p>
                      <SubscribeButton label="Start Free Trial" className="w-full text-xs" />
                    </div>
                  ) : (
                    // Fallback for any other case
                    <div className="w-full text-center" data-testid={`locked-printable-${index}`}>
                      <p className="text-xs text-muted-foreground italic flex items-center justify-center gap-1">
                        <LockIcon className="w-3 h-3" />
                        Coming soon
                      </p>
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Upgrade Prompt for Non-Pro Users */}
        {!isPro && (
          <div className="text-center mt-8 p-8 border rounded-lg bg-card">
            <h2 className="text-2xl font-bold mb-3">Unlock All Printables</h2>
            <p className="mb-4 text-sm text-muted-foreground max-w-xl mx-auto">
              Get instant access to all printables with Camping Planner Pro. Start your 7-day free trial today!
            </p>
            <SubscribeButton 
              label="Start 7-Day Free Trial ($29.99/year)"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3"
            />
            <p className="mt-4 text-xs text-muted-foreground">
              Already purchased via ThriveCart? <a href="mailto:support@thecampingplanner.com" className="underline hover:text-foreground">Contact us</a> to activate Pro access.
            </p>
          </div>
        )}

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            All products are available as instant digital downloads
          </p>
        </div>
      </main>

      {/* Personal Use Agreement Modal */}
      <AlertDialog open={showPersonalUseModal} onOpenChange={setShowPersonalUseModal}>
        <AlertDialogContent data-testid="modal-personal-use">
          <AlertDialogHeader>
            <AlertDialogTitle>Personal Use Only</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              These printables are for your personal, household use only. Please don't upload them to file-sharing sites or resell them. Thank you for supporting The Camping Planner!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-download">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedDownload}
              data-testid="button-confirm-download"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              I Understand – Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
