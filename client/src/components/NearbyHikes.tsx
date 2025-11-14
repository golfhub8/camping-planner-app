import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPinIcon, RefreshCwIcon, ExternalLinkIcon, TrendingUpIcon, MountainIcon, AlertCircleIcon } from "lucide-react";

interface NearbyHikesProps {
  tripId: number;
  location: string;
}

interface TrailSuggestion {
  id: string;
  name: string;
  location: string;
  distance?: number;
  elevationGain?: number;
  difficulty: "easy" | "moderate" | "hard";
  highlights: string[];
  estimatedTime: string;
  parkName?: string;
  url?: string;
}

interface TripAssistantResponse {
  campgrounds: any[];
  mealPlan: any[];
  packingTips: string[];
  trails: TrailSuggestion[];
  warnings?: string[];
}

function inferSeasonFromDate(dateStr?: string): "spring" | "summer" | "fall" | "winter" | undefined {
  if (!dateStr) return undefined;
  
  const date = new Date(dateStr);
  const month = date.getMonth();
  
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getDifficultyVariant(difficulty: "easy" | "moderate" | "hard") {
  switch (difficulty) {
    case "easy":
      return "secondary";
    case "moderate":
      return "default";
    case "hard":
      return "destructive";
  }
}

export default function NearbyHikes({ tripId, location }: NearbyHikesProps) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<TripAssistantResponse>({
    queryKey: ['/api/trip-assistant', tripId, 'trails'],
    queryFn: async () => {
      const prompt = `Best hiking trails near ${location}`;
      
      const response = await apiRequest('POST', '/api/trip-assistant', {
        tripId,
        prompt,
      });
      
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const trails = data?.trails || [];
  const warnings = data?.warnings || [];

  return (
    <Card data-testid="card-nearby-hikes">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MountainIcon className="h-5 w-5 text-primary" />
            Nearby Hikes
            <Badge variant="secondary" className="text-xs">Powered by OpenStreetMap</Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-trails"
          >
            <RefreshCwIcon className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Alert variant="destructive" data-testid="alert-trails-error">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertDescription>
              Failed to load trail suggestions. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings from OpenStreetMap Overpass API */}
        {!isLoading && warnings.length > 0 && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="alert-trails-warning">
            <AlertCircleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {warnings[0]}
            </AlertDescription>
          </Alert>
        )}

        {/* Success State with Trails */}
        {!isLoading && !error && trails.length > 0 && (
          <div className="space-y-3">
            {trails.map((trail) => (
              <div
                key={trail.id}
                className="border rounded-md p-3 space-y-2 hover-elevate"
                data-testid={`card-trail-${trail.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {trail.url ? (
                      <a
                        href={trail.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-primary flex items-center gap-1"
                        data-testid={`link-trail-${trail.id}`}
                      >
                        <span className="truncate">{trail.name}</span>
                        <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="font-medium truncate" data-testid={`text-trail-name-${trail.id}`}>
                        {trail.name}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground truncate" data-testid={`text-trail-location-${trail.id}`}>
                      {trail.parkName || trail.location}
                    </p>
                  </div>
                  <Badge variant={getDifficultyVariant(trail.difficulty)} data-testid={`badge-difficulty-${trail.id}`}>
                    {trail.difficulty}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {trail.distance && (
                    <span className="flex items-center gap-1" data-testid={`text-distance-${trail.id}`}>
                      <MapPinIcon className="h-3 w-3" />
                      {trail.distance} mi
                    </span>
                  )}
                  {trail.elevationGain && (
                    <span className="flex items-center gap-1" data-testid={`text-elevation-${trail.id}`}>
                      <TrendingUpIcon className="h-3 w-3" />
                      {trail.elevationGain} ft gain
                    </span>
                  )}
                  <span data-testid={`text-time-${trail.id}`}>⏱️ {trail.estimatedTime}</span>
                </div>

                {trail.highlights.length > 0 && (
                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-highlights-${trail.id}`}>
                    {trail.highlights[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && trails.length === 0 && warnings.length === 0 && (
          <div className="text-center py-6" data-testid="empty-trails">
            <MountainIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No hiking trails found near this location. Try refreshing or check back later.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
