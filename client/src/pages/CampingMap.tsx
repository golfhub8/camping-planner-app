import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Tent, ExternalLink } from "lucide-react";
import type { Campground } from "@shared/schema";

// Affiliate and referral links from environment variables with fallback defaults
const ALLTRAILS_AFFILIATE =
  import.meta.env.VITE_ALLTRAILS_AFFILIATE ?? "https://alltrails.pxf.io/VxGVyM";
const HIPCAMP_REFERRAL =
  import.meta.env.VITE_HIPCAMP_REFERRAL ??
  "https://www.hipcamp.com/i/sterlings5d0b1c?utm_source=camper_referral&utm_medium=share&utm_campaign=sterlings5d0b1c";

export default function CampingMap() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  // Fetch campgrounds based on active search query
  const { data, isLoading, error } = useQuery<{ campgrounds: Campground[] }>({
    queryKey: ["/api/campgrounds", activeQuery],
    queryFn: async () => {
      const url = `/api/campgrounds?query=${encodeURIComponent(activeQuery)}`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch campgrounds");
      }
      return response.json();
    },
    enabled: activeQuery.length > 0,
  });

  const campgrounds = data?.campgrounds ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveQuery(searchQuery.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Camping Map</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Find campgrounds and discover nearby hiking trails
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search for Campgrounds</CardTitle>
            <CardDescription>
              Enter a location to find campgrounds and outdoor recreation areas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g., Victoria BC, Olympic National Park, Washington"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                data-testid="input-location-search"
              />
              <Button type="submit" data-testid="button-search-campgrounds">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Searching for campgrounds...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">
                Error loading campgrounds. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && activeQuery && campgrounds.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Tent className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No campgrounds found for "{activeQuery}". Try a different location.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Campground Results */}
        {!isLoading && !error && campgrounds.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">
              Found {campgrounds.length} {campgrounds.length === 1 ? "campground" : "campgrounds"}
            </h2>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campgrounds.map((campground) => {
                // Build AllTrails URL with search parameter
                const hikesUrl = `${ALLTRAILS_AFFILIATE}?search=${encodeURIComponent(
                  campground.name ?? activeQuery ?? ""
                )}`;

                return (
                  <Card key={campground.id} data-testid={`card-campground-${campground.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-2" data-testid={`text-campground-name-${campground.id}`}>
                            {campground.name}
                          </CardTitle>
                          {campground.type && (
                            <CardDescription data-testid={`text-campground-type-${campground.id}`}>
                              {campground.type}
                            </CardDescription>
                          )}
                        </div>
                        <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Location */}
                      <div className="text-sm text-muted-foreground">
                        <p data-testid={`text-campground-location-${campground.id}`}>
                          {campground.location}
                        </p>
                      </div>

                      {/* Description */}
                      {campground.description && (
                        <div className="text-sm">
                          <p>{campground.description}</p>
                        </div>
                      )}

                      {/* Affiliate Buttons */}
                      <div className="flex flex-col gap-2 pt-2">
                        <a
                          href={hikesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover-elevate active-elevate-2 transition-colors"
                          data-testid={`link-alltrails-${campground.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Nearby hikes (AllTrails)
                        </a>
                        <a
                          href={HIPCAMP_REFERRAL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover-elevate active-elevate-2 transition-colors dark:bg-slate-700"
                          data-testid={`link-hipcamp-${campground.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Find a campsite (Hipcamp)
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Initial State (No Search Yet) */}
        {!activeQuery && !isLoading && (
          <Card>
            <CardContent className="pt-6 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Ready to explore?</h3>
              <p className="text-muted-foreground">
                Enter a location above to find campgrounds and discover nearby hiking trails
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
