import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, LogOut, User, CreditCard, Crown, Bug } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import SubscribeButton from "./SubscribeButton";
import BugReportModal from "./BugReportModal";
import bannerImage from "@assets/The Camping Planner banner 1 (1)_1762580023779.jpg";

export default function Navbar() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const { user } = useAuth();
  const { handleLogout } = useLogout();

  const navLinks = [
    { path: "/trips", label: "Trips", matchExact: false },
    { path: "/recipes", label: "Recipes", matchExact: true },
    { path: "/grocery", label: "Grocery", matchExact: false },
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
        <div className="flex h-24 items-center justify-between gap-4">
          <Link href="/trips" className="flex items-center hover-elevate rounded-lg px-2 py-1" data-testid="link-logo">
            <img src={bannerImage} alt="The Camping Planner" className="h-16" />
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
            {/* Show "Go Pro" button for free users, "Pro Trial"/"Pro Member" badge for Pro users */}
            {user?.isPro ? (
              <Link href="/account">
                <Badge variant="default" className="gap-1.5 px-3 py-1.5 hover-elevate cursor-pointer" data-testid="badge-pro-member">
                  <Crown className="w-3.5 h-3.5" />
                  {user.subscriptionStatus === 'trialing' ? 'Pro Trial' : 'Pro Member'}
                </Badge>
              </Link>
            ) : (
              <SubscribeButton label="Go Pro" />
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0" data-testid="button-user-menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center cursor-pointer" data-testid="menu-item-account">
                    <User className="mr-2 h-4 w-4" />
                    <span>My Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center cursor-pointer" data-testid="menu-item-subscription">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Manage Subscription</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setBugReportOpen(true)} className="flex items-center cursor-pointer" data-testid="menu-item-bug-report">
                  <Bug className="mr-2 h-4 w-4" />
                  <span>Report a Bug</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="flex items-center cursor-pointer" data-testid="menu-item-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <BugReportModal open={bugReportOpen} onOpenChange={setBugReportOpen} />
    </header>
  );
}
