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
  const [pendingDownload, setPendingDownload] = useState<{ url: string; isPro: boolean } | null>(null);

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

  // Handle download initiation - show personal use modal first
  const initiateDownload = (url: string, isProFile: boolean) => {
    setPendingDownload({ url, isPro: isProFile });
    setShowPersonalUseModal(true);
  };

  // Handle confirmed download after user agrees to terms
  const handleConfirmedDownload = async () => {
    if (!pendingDownload) return;

    setShowPersonalUseModal(false);

    // For Pro files, use the protected endpoint which requires authentication
    if (pendingDownload.isPro) {
      try {
        const response = await fetch(pendingDownload.url, {
          credentials: 'include', // Include cookies for authentication
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

        // Download the PDF blob
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = pendingDownload.url.split('/').pop() || 'printable.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('Download error:', error);
        toast({
          title: "Download Failed",
          description: "Unable to download the printable. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // For free files, use direct download
      window.open(pendingDownload.url, '_blank');
    }

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
      
      
      <main className="container mx-auto pt-24 px-6 md:px-10 py-12 max-w-6xl">
        {/* Configuration Warning Banner */}
        {!isStripeConfigured && (
          <Alert className="mb-6" data-testid="alert-stripe-not-configured">
            <AlertDescription>
              Payments not configured. Stripe checkout is unavailable until STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set.
            </AlertDescription>
          </Alert>
        )}

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4" data-testid="text-page-title">
            Printables & Games
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
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
                      onClick={() => initiateDownload(`/api/printables/download/${p.id}`, true)}
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
              These printables are for your personal and household use only. Please do not upload, resell, or share the files publicly. By clicking Download, you agree to these terms.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-download">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmedDownload}
              data-testid="button-confirm-download"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Agree & Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
