import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share2, ArrowLeft, Loader2, Carrot, Milk, Beef, Package, Tent, Copy, Check, Mail } from "lucide-react";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CAMPING_BASICS, type GroceryItem, type GroceryCategory } from "@shared/schema";
import type { LucideIcon } from "lucide-react";

// Category icon and color mapping
const categoryConfig: Record<GroceryCategory, { Icon: LucideIcon; color: string }> = {
  "Produce": { Icon: Carrot, color: "text-green-600 dark:text-green-400" },
  "Dairy": { Icon: Milk, color: "text-blue-600 dark:text-blue-400" },
  "Meat": { Icon: Beef, color: "text-red-600 dark:text-red-400" },
  "Pantry": { Icon: Package, color: "text-yellow-600 dark:text-yellow-400" },
  "Camping Gear": { Icon: Tent, color: "text-purple-600 dark:text-purple-400" },
};

// Page for displaying the generated grocery list
// Shows items grouped by category with checkboxes to mark items as "already have"
export default function GroceryList() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ token?: string }>();
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [showOnlyNeeded, setShowOnlyNeeded] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [listToken, setListToken] = useState<string | null>(params.token || null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Parse recipe IDs and external meal titles from URL query parameters (for backward compatibility)
  const searchParams = new URLSearchParams(window.location.search);
  const recipeIds = searchParams.getAll("recipeIds").map(id => parseInt(id));
  const externalMeals = searchParams.getAll("externalMeals");

  // Generate grocery list from selected recipes
  const generateListMutation = useMutation({
    mutationFn: async (recipeIds: number[]) => {
      const response = await apiRequest("POST", "/api/grocery/generate", { recipeIds });
      const data = await response.json();
      return data as { items: GroceryItem[] };
    },
    onSuccess: (data) => {
      // Add external meal titles as Pantry items
      const externalMealItems: GroceryItem[] = externalMeals.map(title => ({
        name: title + " (see trip for recipe details)",
        category: "Pantry" as const,
        checked: false,
      }));
      setGroceryItems([...data.items, ...externalMealItems]);
    },
  });

  // Load or save grocery list on component mount
  useEffect(() => {
    async function loadOrSaveList() {
      // CASE 1: Viewing a saved list by token
      if (listToken) {
        console.log(`[GroceryList] Loading saved list from token: ${listToken}`);
        try {
          const response = await fetch(`/api/grocery-lists/${listToken}`);
          if (response.ok) {
            const savedList = await response.json();
            // Extract items from the saved list
            const items = savedList.items as GroceryItem[];
            setGroceryItems(items);
            console.log(`[GroceryList] Loaded ${items.length} items from saved list`);
            return;
          } else {
            console.error('[GroceryList] Failed to load saved list:', await response.text());
            toast({
              title: "Error loading list",
              description: "The grocery list could not be found. It may have expired.",
              variant: "destructive",
            });
            setLocation("/grocery");
          }
        } catch (error) {
          console.error('[GroceryList] Error loading saved list:', error);
        }
        return;
      }

      // CASE 2: User came from GrocerySelection with confirmed data - SAVE TO DATABASE
      const confirmedData = sessionStorage.getItem('confirmedGroceryData');
      if (confirmedData && !isSaving) {
        try {
          setIsSaving(true);
          const { needed, pantry, externalMeals: extMeals, tripId, tripName } = JSON.parse(confirmedData);
          
          // Convert to GroceryItems
          const neededItems: GroceryItem[] = (needed || []).map((ing: any) => ({
            name: ing.name,
            category: ing.category || "Pantry" as GroceryCategory,
            checked: false,
          }));
          
          const pantryItems: GroceryItem[] = (pantry || []).map((ing: any) => ({
            name: ing.name,
            category: ing.category || "Pantry" as GroceryCategory,
            checked: true,
          }));
          
          const externalItems: GroceryItem[] = (extMeals || []).map((title: string) => ({
            name: title + " (see trip for recipe details)",
            category: "Pantry" as const,
            checked: false,
          }));
          
          const allItems = [...neededItems, ...pantryItems, ...externalItems];
          
          console.log(`[GroceryList] Saving ${allItems.length} items to database${tripId ? ` for trip ${tripName} (ID: ${tripId})` : ''}...`);
          
          // Save to database
          const response = await apiRequest("POST", "/api/grocery-lists", {
            items: allItems,
            tripId: tripId || undefined,
            tripName: tripName || undefined,
          });
          
          const data = await response.json();
          const token = data.token;
          
          console.log(`[GroceryList] Successfully saved list with token: ${token}`);
          
          // Clear sessionStorage
          sessionStorage.removeItem('confirmedGroceryData');
          
          // Invalidate queries to refresh usage stats
          queryClient.invalidateQueries({ queryKey: ["/api/account/usage"] });
          
          // Redirect to token-based URL
          setLocation(`/grocery/list/${token}`);
          
        } catch (error: any) {
          console.error('[GroceryList] Error saving list:', error);
          setIsSaving(false);
          
          // Check if it's a paywall error
          if (error.status === 402) {
            const errorData = await error.response?.json();
            toast({
              title: "Upgrade Required",
              description: errorData.message || "You've reached the free limit. Start a free trial to create unlimited lists.",
              variant: "destructive",
            });
            setLocation("/subscribe");
            return;
          }
          
          toast({
            title: "Failed to save list",
            description: "Your list could not be saved. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

      // CASE 3: Legacy behavior - load from query params (backward compatibility)
      if (recipeIds.length > 0) {
        generateListMutation.mutate(recipeIds);
      } else if (externalMeals.length > 0) {
        const externalMealItems: GroceryItem[] = externalMeals.map(title => ({
          name: title + " (see trip for recipe details)",
          category: "Pantry" as const,
          checked: false,
        }));
        setGroceryItems(externalMealItems);
      }
    }

    loadOrSaveList();
  }, [listToken]);

  // Toggle item checked state
  function toggleItem(index: number) {
    setGroceryItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  }

  // Create shareable link mutation
  const createShareLinkMutation = useMutation({
    mutationFn: async (items: GroceryItem[]) => {
      const response = await apiRequest("POST", "/api/grocery/share/link", { items });
      const data = await response.json();
      return data as { token: string; shareUrl: string };
    },
    onSuccess: (data) => {
      setShareUrl(data.shareUrl);
      setShareDialogOpen(true);
      toast({
        title: "Share link created!",
        description: "Copy the link to share your grocery list with others.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create share link",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle creating shareable link
  function handleShare() {
    const neededItems = groceryItems.filter(item => !item.checked);
    if (neededItems.length === 0) {
      toast({
        title: "No items to share",
        description: "All items are checked off. Uncheck some items to share.",
        variant: "destructive",
      });
      return;
    }
    createShareLinkMutation.mutate(neededItems);
  }

  // Copy share URL to clipboard
  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "You can now paste and share the link.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  }

  // Send grocery list via email using mailto link
  function sendViaEmail() {
    // Validate email address using HTML5 email validation
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    if (!emailAddress || !emailInput?.checkValidity()) {
      toast({
        title: "Invalid email address",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // Guard against empty share URL
    if (!shareUrl) {
      toast({
        title: "Share link not available",
        description: "Please create a share link first.",
        variant: "destructive",
      });
      return;
    }

    const subject = encodeURIComponent("Grocery List for Our Camping Trip");
    const body = encodeURIComponent(
      `Hi!\n\nI'm sharing our grocery list for the upcoming camping trip. You can view it here:\n\n${shareUrl}\n\nThis list includes all the items we need. Check it out and let me know if I missed anything!\n\nHappy camping!\n- Sent from The Camping Planner`
    );
    
    const mailtoLink = `mailto:${emailAddress.trim()}?subject=${subject}&body=${body}`;
    
    // Open email client
    window.location.href = mailtoLink;
    
    toast({
      title: "Email client opened",
      description: `Opening your email client to send to ${emailAddress.trim()}`,
    });
    
    // Clear email input after sending
    setEmailAddress("");
  }

  // Fetch user's selected camping basics
  const { data: selectedBasicsData } = useQuery<{ selectedBasics: string[] }>({
    queryKey: ["/api/camping-basics"],
  });
  const selectedBasics = selectedBasicsData?.selectedBasics || [];

  // Add camping basic mutation
  const addCampingBasicMutation = useMutation({
    mutationFn: async (basicId: string) => {
      const response = await apiRequest("POST", "/api/camping-basics", { basicId });
      const data = await response.json();
      return data as { selectedBasics: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/camping-basics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add camping basic",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Remove camping basic mutation
  const removeCampingBasicMutation = useMutation({
    mutationFn: async (basicId: string) => {
      const response = await apiRequest("DELETE", `/api/camping-basics/${basicId}`);
      const data = await response.json();
      return data as { selectedBasics: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/camping-basics"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove camping basic",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Toggle camping basic selection
  function toggleCampingBasic(basicId: string) {
    if (selectedBasics.includes(basicId)) {
      removeCampingBasicMutation.mutate(basicId);
    } else {
      addCampingBasicMutation.mutate(basicId);
    }
  }

  // Group items by category
  const groupedItems: Record<GroceryCategory, GroceryItem[]> = {
    "Produce": [],
    "Dairy": [],
    "Meat": [],
    "Pantry": [],
    "Camping Gear": [],
  };

  groceryItems.forEach(item => {
    groupedItems[item.category].push(item);
  });

  // Filter items based on showOnlyNeeded toggle
  const displayedItems = showOnlyNeeded 
    ? groceryItems.filter(item => !item.checked)
    : groceryItems;

  if (recipeIds.length === 0 && externalMeals.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12 max-w-4xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">No Recipes Selected</h2>
            <p className="text-muted-foreground mb-6">
              Please select some recipes first to generate a grocery list.
            </p>
            <Button onClick={() => setLocation("/grocery")} data-testid="button-select-recipes">
              Select Recipes
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (generateListMutation.isPending) {
    return (
      <div className="min-h-screen bg-background">
        
        <main className="container mx-auto pt-24 px-6 md:px-10 py-12">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  const neededCount = groceryItems.filter(item => !item.checked).length;

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto pt-24 px-6 md:px-10 py-12 max-w-4xl">
      {/* Header Section */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/grocery")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Recipe Selection
        </Button>
        <h1 className="text-4xl font-bold mb-2">Your Grocery List</h1>
        <p className="text-lg text-muted-foreground">
          Check off items you already have at home
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="show-needed"
                checked={showOnlyNeeded}
                onCheckedChange={setShowOnlyNeeded}
                data-testid="switch-show-needed"
              />
              <Label htmlFor="show-needed" className="cursor-pointer">
                Show Only Needed Items
              </Label>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" data-testid="badge-total-count">
                {groceryItems.length} total items
              </Badge>
              <Badge className="bg-primary" data-testid="badge-needed-count">
                {neededCount} needed
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camping Basics Section */}
      <Card className="mb-6" data-testid="card-camping-basics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tent className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span>Camping Basics</span>
            <Badge variant="outline" className="ml-2">
              {selectedBasics.length} selected
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Common camping essentials you may want to add to your list. Your selections persist across sessions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {CAMPING_BASICS.map((basic) => {
              const isSelected = selectedBasics.includes(basic.id);
              return (
                <div
                  key={basic.id}
                  className={`flex items-center gap-3 p-2 rounded-md hover-elevate ${
                    !isSelected ? "opacity-50" : ""
                  }`}
                  data-testid={`camping-basic-${basic.id}`}
                >
                  <Checkbox
                    id={`basic-${basic.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleCampingBasic(basic.id)}
                    data-testid={`checkbox-basic-${basic.id}`}
                  />
                  <label
                    htmlFor={`basic-${basic.id}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    {basic.name}
                  </label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grocery Items by Category */}
      <div className="space-y-6">
        {(Object.keys(groupedItems) as GroceryCategory[]).map(category => {
          const categoryItems = groupedItems[category];
          const visibleItems = showOnlyNeeded 
            ? categoryItems.filter(item => !item.checked)
            : categoryItems;

          if (visibleItems.length === 0) return null;

          const config = categoryConfig[category];

          const { Icon, color } = config;
          
          return (
            <Card key={category} data-testid={`category-${category.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span>{category}</span>
                  <Badge variant="outline" className="ml-2">
                    {visibleItems.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categoryItems.map((item, index) => {
                  const globalIndex = groceryItems.indexOf(item);
                  if (showOnlyNeeded && item.checked) return null;

                  return (
                    <div
                      key={globalIndex}
                      className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                      data-testid={`item-${globalIndex}`}
                    >
                      <Checkbox
                        id={`item-${globalIndex}`}
                        checked={item.checked}
                        onCheckedChange={() => toggleItem(globalIndex)}
                        data-testid={`checkbox-item-${globalIndex}`}
                      />
                      <label
                        htmlFor={`item-${globalIndex}`}
                        className={`flex-1 cursor-pointer ${
                          item.checked ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.name}
                      </label>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end mt-8">
        <Button
          variant="outline"
          onClick={() => setLocation("/")}
          data-testid="button-home"
        >
          Back to Recipes
        </Button>
        <Button
          onClick={handleShare}
          disabled={neededCount === 0 || createShareLinkMutation.isPending}
          data-testid="button-share"
        >
          {createShareLinkMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Link...
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4 mr-2" />
              Share List ({neededCount} items)
            </>
          )}
        </Button>
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent data-testid="dialog-share">
          <DialogHeader>
            <DialogTitle>Share Your Grocery List</DialogTitle>
            <DialogDescription>
              Anyone with this link can view your grocery list. The link never expires.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Share Link</Label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
                  data-testid="input-share-url"
                />
                <Button
                  onClick={copyShareUrl}
                  variant="outline"
                  size="icon"
                  data-testid="button-copy-url"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <Label htmlFor="email-input" className="text-sm font-medium mb-2 block">
                Send via Email
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="email-input"
                  type="email"
                  placeholder="friend@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendViaEmail();
                    }
                  }}
                  className="flex-1 px-3 py-2 border rounded-md text-sm"
                  data-testid="input-email-address"
                />
                <Button
                  onClick={sendViaEmail}
                  variant="default"
                  className="gap-2"
                  disabled={!emailAddress}
                  data-testid="button-send-email"
                >
                  <Mail className="h-4 w-4" />
                  Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This will open your email client with a pre-filled message
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </main>
    </div>
  );
}
