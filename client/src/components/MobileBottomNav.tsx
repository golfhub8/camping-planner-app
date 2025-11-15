import { Link, useLocation } from "wouter";
import { Home, BookOpen, ShoppingCart, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileBottomNav() {
  const [location] = useLocation();

  const tabs = [
    { path: "/", label: "Trips", icon: Home, testId: "nav-trips" },
    { path: "/recipes", label: "Recipes", icon: BookOpen, testId: "nav-recipes" },
    { path: "/grocery", label: "Grocery", icon: ShoppingCart, testId: "nav-grocery" },
    { path: "/printables", label: "Printables", icon: FileText, testId: "nav-printables" },
    { path: "/account", label: "Account", icon: User, testId: "nav-account" },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location.startsWith(path);
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-inset-bottom"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ path, label, icon: Icon, testId }) => {
          const active = isActive(path);
          return (
            <Link key={path} href={path}>
              <a
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[64px] transition-colors",
                  active 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={testId}
              >
                <Icon className={cn("h-5 w-5", active && "fill-current")} />
                <span className="text-xs font-medium">{label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
