import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLinkIcon, FileTextIcon, GamepadIcon, BookOpenIcon } from "lucide-react";

export default function Printables() {
  // Product data
  const products = [
    {
      title: "The Camping Planner",
      description: "Plan your perfect camping trip with our comprehensive planner. Includes meal planning, packing lists, itinerary templates, and more to help you stay organized on your outdoor adventures.",
      icon: FileTextIcon,
      url: "https://thecampingplanner.com/shop/",
    },
    {
      title: "Camping Activity Book",
      description: "Keep the kids entertained with fun camping-themed activities! Features coloring pages, puzzles, nature scavenger hunts, and interactive games perfect for young campers.",
      icon: BookOpenIcon,
      url: "https://thecampingplanner.com/shop/",
    },
    {
      title: "Camping Games Bundle",
      description: "Make your camping trip unforgettable with our complete games bundle! Includes camping charades, nature scavenger hunts, campfire bingo, and other fun activities for the whole family.",
      icon: GamepadIcon,
      url: "https://thecampingplanner.com/shop/",
    },
  ];

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
        </div>

        {/* Product Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => {
            const Icon = product.icon;
            return (
              <Card key={index} className="flex flex-col" data-testid={`card-product-${index}`}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-xl" data-testid={`text-product-title-${index}`}>
                    {product.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {product.description}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto">
                  <Button
                    asChild
                    className="w-full"
                    data-testid={`button-view-product-${index}`}
                  >
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on TheCampingPlanner.com
                      <ExternalLinkIcon className="w-4 h-4 ml-2" />
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
