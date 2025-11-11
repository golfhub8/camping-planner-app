import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import SubscribeButton from "./SubscribeButton";
import bannerImage from "@assets/The Camping Planner banner 1 (1)_1762580023779.jpg";

export default function Navbar() {
  const [location] = useLocation();

  const navLinks = [
    { path: "/", label: "Recipes" },
    { path: "/trips", label: "Trips" },
    { path: "/printables", label: "Printables" },
  ];

  return (
    <nav className="w-full flex items-center justify-between px-6 py-3 bg-background border-b" data-testid="navbar">
      <div className="flex items-center gap-6">
        <Link href="/">
          <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={bannerImage} alt="The Camping Planner" className="h-8" />
          </a>
        </Link>
        
        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link key={link.path} href={link.path}>
              <a>
                <Button
                  variant={location === link.path ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`nav-link-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Button>
              </a>
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
