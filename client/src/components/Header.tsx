import { Link, useLocation } from "wouter";
import { Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import bannerImage from "@assets/The Camping Planner banner 1 (1)_1762580023779.jpg";

export default function Header() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 md:px-10">
        <div className="flex h-28 items-center justify-between gap-4">
          <Link href="/" className="flex items-center hover-elevate rounded-lg px-2 py-1" data-testid="link-home">
            <img src={bannerImage} alt="The Camping Planner" className="h-20" />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/" data-testid="link-recipes">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                size="default"
                data-testid="button-nav-recipes"
              >
                Recipes
              </Button>
            </Link>
            <Link href="/grocery" data-testid="link-grocery">
              <Button
                variant={location.startsWith("/grocery") ? "secondary" : "ghost"}
                size="default"
                data-testid="button-nav-grocery"
              >
                Grocery
              </Button>
            </Link>
            <Link href="/trips" data-testid="link-trips">
              <Button
                variant={location.startsWith("/trips") ? "secondary" : "ghost"}
                size="default"
                data-testid="button-nav-trips"
              >
                Trips
              </Button>
            </Link>
            <Link href="/printables" data-testid="link-printables">
              <Button
                variant={location.startsWith("/printables") ? "secondary" : "ghost"}
                size="default"
                data-testid="button-nav-printables"
              >
                Printables
              </Button>
            </Link>
          </nav>

          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search recipes..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </form>

          {/* User profile and logout */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10" data-testid="avatar-user">
              <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
              <AvatarFallback>{getUserInitials()}</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              asChild
              title="Log out"
              data-testid="button-logout"
            >
              <a href="/api/logout">
                <LogOut className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
