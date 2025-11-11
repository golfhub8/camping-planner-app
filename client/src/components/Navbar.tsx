import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import SubscribeButton from "./SubscribeButton";
import bannerImage from "@assets/The Camping Planner banner 1 (1)_1762580023779.jpg";

export default function Navbar() {
  const [location] = useLocation();

  const navLinks = [
    { path: "/", label: "Recipes", matchExact: true },
    { path: "/trips", label: "Trips", matchExact: false },
    { path: "/map", label: "Map", matchExact: false },
    { path: "/printables", label: "Printables", matchExact: false },
  ];

  // Helper to determine if a nav link is active
  const isActive = (linkPath: string, matchExact: boolean) => {
    if (matchExact) {
      return location === linkPath;
    }
    // For non-exact matches, check if current location starts with the link path
    return location === linkPath || location.startsWith(linkPath + "/");
  };

  return (
    <nav className="w-full flex items-center justify-between px-6 py-3 bg-background border-b" data-testid="navbar">
      <div className="flex items-center gap-6">
        <Link href="/" data-testid="link-logo">
          <img src={bannerImage} alt="The Camping Planner" className="h-8 hover:opacity-80 transition-opacity cursor-pointer" />
        </Link>
        
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      <div className="flex items-center gap-2">
        <SubscribeButton label="Go Pro" />
        
        <Button
          variant="ghost"
          size="sm"
          asChild
          data-testid="button-logout"
        >
          <a href="/api/auth/logout">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </a>
        </Button>
      </div>
    </nav>
  );
}
