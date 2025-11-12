import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import RecipeDetail from "@/pages/RecipeDetail";
import SearchResults from "@/pages/SearchResults";
import GrocerySelection from "@/pages/GrocerySelection";
import GroceryList from "@/pages/GroceryList";
import GroceryShare from "@/pages/GroceryShare";
import MyGroceryList from "@/pages/MyGroceryList";
import Trips from "@/pages/Trips";
import TripDetail from "@/pages/TripDetail";
import Printables from "@/pages/Printables";
import Checkout from "@/pages/Checkout";
import Subscribe from "@/pages/Subscribe";
import SharedGroceryView from "@/pages/SharedGroceryView";
import CampingMap from "@/pages/CampingMap";
import Account from "@/pages/Account";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import bannerImage from "@assets/The Camping Planner banner 1 (1)_1762580023779.jpg";

// Landing page for logged out users
function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-6 md:px-10 py-12 flex-1 flex flex-col items-center justify-center max-w-4xl">
        <img src={bannerImage} alt="The Camping Planner" className="h-32 mb-8" />
        
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-2">Welcome to The Camping Planner</CardTitle>
            <CardDescription className="text-lg">
              Organize your camping trips, plan meals, and manage your recipes all in one place
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Sign in to start planning your next outdoor adventure with:
            </p>
            <ul className="text-left space-y-2 max-w-sm mx-auto">
              <li className="flex items-start">
                <span className="mr-2">🍳</span>
                <span>Create and save camping recipes</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">📋</span>
                <span>Generate organized grocery lists</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">⛺</span>
                <span>Plan trips with meal schedules</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">👥</span>
                <span>Share trips with family and friends</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              asChild
              size="lg"
              data-testid="button-login"
            >
              <a href="/api/login">
                Log In to Get Started
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Public routes that don't require authentication
  return (
    <Switch>
      {/* Public shared grocery list view - no auth required */}
      <Route path="/shared/:token" component={SharedGroceryView} />
      
      {/* All other routes require authentication */}
      <Route>
        {() => {
          // Show loading state while checking authentication
          if (isLoading) {
            return (
              <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                  <img src={bannerImage} alt="The Camping Planner" className="h-24 mx-auto mb-4" />
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              </div>
            );
          }

          // Show landing page if not authenticated
          if (!isAuthenticated) {
            return <Landing />;
          }

          // Show authenticated app routes with Navbar
          return (
            <div className="min-h-screen bg-background flex flex-col">
              <Navbar />
              <main className="flex-1">
                <Switch>
                  <Route path="/" component={Trips} />
                  <Route path="/recipes" component={Home} />
                  <Route path="/recipe/:id" component={RecipeDetail} />
                  <Route path="/search" component={SearchResults} />
                  <Route path="/grocery" component={GrocerySelection} />
                  <Route path="/grocery/list" component={GroceryList} />
                  <Route path="/grocery/share" component={GroceryShare} />
                  <Route path="/grocery/my-list" component={MyGroceryList} />
                  <Route path="/trips/:id" component={TripDetail} />
                  <Route path="/trips" component={Trips} />
                  <Route path="/map" component={CampingMap} />
                  <Route path="/printables" component={Printables} />
                  <Route path="/checkout" component={Checkout} />
                  <Route path="/subscribe" component={Subscribe} />
                  <Route path="/account" component={Account} />
                  <Route component={NotFound} />
                </Switch>
              </main>
            </div>
          );
        }}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
