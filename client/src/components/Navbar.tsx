import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import SubscribeButton from "./SubscribeButton";
import bannerImage from "@assets/The Camping Planner banner 1 (1)_1762580023779.jpg";

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();

  const navLinks = [
    { path: "/", label: "Recipes", matchExact: true },
    { path: "/grocery", label: "Grocery", matchExact: false },
    { path: "/trips", label: "Trips", matchExact: false },
    { path: "/map", label: "Map", matchExact: false },
    { path: "/printables", label: "Printables", matchExact: false },
  ];

  const isActive = (linkPath: string, matchExact: boolean) => {
    if (matchExact) {
      return location === linkPath;
    }
    return location === linkPath || location.startsWith(linkPath + "/");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" data-testid="navbar">
      <div className="container mx-auto px-6 md:px-10">
        <div className="flex h-18 items-center justify-between gap-4">
          <Link href="/" className="flex items-center hover-elevate rounded-lg px-2 py-1" data-testid="link-logo">
            <img src={bannerImage} alt="The Camping Planner" className="h-12" />
          </Link>

          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.path} href={link.path}>
                <Button
                  variant={isActive(link.path, link.matchExact) ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`nav-link-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Button>
              </Link>
            ))}
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

          <div className="flex items-center gap-3">
            <SubscribeButton label="Go Pro" />
            
            <Avatar className="h-9 w-9" data-testid="avatar-user">
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
              <a href="/api/auth/logout">
                <LogOut className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
