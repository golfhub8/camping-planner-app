import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileTextIcon, GamepadIcon, BookOpenIcon, DownloadIcon, LockIcon, CheckCircle2Icon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import SubscribeButton from "../components/SubscribeButton";
import Header from "@/components/Header";

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
  // Get all printables (free and Pro)
  const { data, isLoading } = useQuery<PrintablesResponse>({
    queryKey: ['/api/printables/downloads'],
  });

  const printables = data?.printables || [];
  const isPro = data?.user?.isPro || false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 md:px-10 py-12">
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 md:px-10 py-12 max-w-6xl">
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
                    <Button
                      asChild
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                      data-testid={`button-download-${index}`}
                    >
                      <a href={p.file} target="_blank" rel="noreferrer">
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        Download Free
                      </a>
                    </Button>
                  ) : p.file ? (
                    <Button
                      asChild
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      data-testid={`button-download-${index}`}
                    >
                      <a href={p.file} target="_blank" rel="noreferrer">
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        Download (Pro)
                      </a>
                    </Button>
                  ) : (
                    <div className="w-full text-center" data-testid={`locked-printable-${index}`}>
                      <p className="text-xs text-muted-foreground italic flex items-center justify-center gap-1">
                        <LockIcon className="w-3 h-3" />
                        Available with Pro Membership
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
    </div>
  );
}
