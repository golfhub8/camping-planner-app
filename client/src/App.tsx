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
import Trips from "@/pages/Trips";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/recipe/:id" component={RecipeDetail} />
      <Route path="/search" component={SearchResults} />
      <Route path="/grocery" component={GrocerySelection} />
      <Route path="/grocery/list" component={GroceryList} />
      <Route path="/grocery/share" component={GroceryShare} />
      <Route path="/trips" component={Trips} />
      <Route component={NotFound} />
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
