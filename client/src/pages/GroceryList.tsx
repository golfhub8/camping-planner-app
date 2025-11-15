import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Share2, ArrowLeft, Loader2, Copy, Check, Mail, ChevronDown, Plus } from "lucide-react";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CAMPING_BASICS, type GroceryItem } from "@shared/schema";

export default function GroceryList() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ token?: string }>();
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [listToken, setListToken] = useState<string | null>(params.token || null);
  const [campingBasicsOpen, setCampingBasicsOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const searchParams = new URLSearchParams(window.location.search);
  const recipeIds = searchParams.getAll("recipeIds").map(id => parseInt(id));
  const externalMeals = searchParams.getAll("externalMeals");

  const generateListMutation = useMutation({
    mutationFn: async (recipeIds: number[]) => {
      const response = await apiRequest("POST", "/api/grocery/generate", { recipeIds });
      const data = await response.json();
      return data as { items: GroceryItem[] };
    },
    onSuccess: (data) => {
      const externalMealItems: GroceryItem[] = externalMeals.map(title => ({
        name: title + " (see trip for recipe details)",
        category: "Pantry" as const,
        checked: false,
      }));
      setGroceryItems([...data.items, ...externalMealItems]);
    },
  });

  useEffect(() => {
    async function loadList() {
      if (listToken) {
        try {
          const response = await fetch(`/api/grocery-lists/${listToken}`);
          if (response.ok) {
            const savedList = await response.json();
            const items = savedList.items as GroceryItem[];
            setGroceryItems(items);
            return;
          } else {
            toast({
              title: "Error loading list",
              description: "The grocery list could not be found.",
              variant: "destructive",
            });
            setLocation("/grocery");
          }
        } catch (error) {
          console.error('Error loading saved list:', error);
        }
        return;
      }

      if (!listToken && recipeIds.length === 0 && externalMeals.length === 0) {
        toast({
          title: "No list found",
          description: "Please build a grocery list first.",
        });
        setLocation("/grocery");
        return;
      }

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

    loadList();
  }, [listToken]);

  function toggleItem(index: number) {
    setGroceryItems(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  }

  function addCustomItem() {
    if (!newItemName.trim()) return;
    
    const newItem: GroceryItem = {
      name: newItemName.trim(),
      category: "Pantry",
      checked: false,
    };
    
    setGroceryItems(prev => [...prev, newItem]);
    setNewItemName("");
    
    toast({
      title: "Item added",
      description: `${newItemName.trim()} added to your list`,
    });
  }

  const createShareLinkMutation = useMutation({
    mutationFn: async () => {
      const neededItems = groceryItems.filter(item => !item.checked);
      const response = await apiRequest("POST", "/api/grocery-lists", {
        items: neededItems,
      });
      const data = await response.json();
      return data as { token: string };
    },
    onSuccess: (data) => {
      const url = `${window.location.origin}/grocery-lists/${data.token}`;
      setShareUrl(url);
      setShareDialogOpen(true);
    },
    onError: () => {
      toast({
        title: "Failed to create share link",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  function handleShare() {
    createShareLinkMutation.mutate();
  }

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

  function sendViaEmail() {
    const emailInput = document.getElementById('email-input') as HTMLInputElement;
    if (!emailAddress || !emailInput?.checkValidity()) {
      toast({
        title: "Invalid email address",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

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
      `Hi!\n\nI'm sharing our grocery list for the upcoming camping trip. You can view it here:\n\n${shareUrl}\n\nHappy camping!`
    );
    
    window.location.href = `mailto:${emailAddress.trim()}?subject=${subject}&body=${body}`;
    
    toast({
      title: "Email client opened",
      description: `Opening your email client to send to ${emailAddress.trim()}`,
    });
    
    setEmailAddress("");
  }

  const { data: selectedBasicsData } = useQuery<{ selectedBasics: string[] }>({
    queryKey: ["/api/camping-basics"],
  });
  const selectedBasics = selectedBasicsData?.selectedBasics || [];

  const addCampingBasicMutation = useMutation({
    mutationFn: async (basicId: string) => {
      const response = await apiRequest("POST", "/api/camping-basics", { basicId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/camping-basics"] });
    },
  });

  const removeCampingBasicMutation = useMutation({
    mutationFn: async (basicId: string) => {
      const response = await apiRequest("DELETE", `/api/camping-basics/${basicId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/camping-basics"] });
    },
  });

  function toggleCampingBasic(basicId: string) {
    if (selectedBasics.includes(basicId)) {
      removeCampingBasicMutation.mutate(basicId);
    } else {
      addCampingBasicMutation.mutate(basicId);
    }
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

  if (groceryItems.length === 0) {
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

  const neededCount = groceryItems.filter(item => !item.checked).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto pt-24 px-6 md:px-10 py-12 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => setLocation("/grocery")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Grocery List</h1>
          <p className="text-muted-foreground">
            {neededCount} {neededCount === 1 ? 'item' : 'items'} to get
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {groceryItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border"
              data-testid={`item-${index}`}
            >
              <Checkbox
                id={`item-${index}`}
                checked={item.checked}
                onCheckedChange={() => toggleItem(index)}
                data-testid={`checkbox-item-${index}`}
              />
              <label
                htmlFor={`item-${index}`}
                className={`flex-1 cursor-pointer ${
                  item.checked ? "line-through text-muted-foreground" : ""
                }`}
              >
                {item.name}
              </label>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); addCustomItem(); }} className="flex gap-2">
            <Input
              type="text"
              placeholder="Add custom item..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              data-testid="input-add-item"
            />
            <Button type="submit" disabled={!newItemName.trim()} data-testid="button-add-item">
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <Collapsible open={campingBasicsOpen} onOpenChange={setCampingBasicsOpen} className="mb-8">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between" data-testid="button-toggle-camping-basics">
              <span>Camping Essentials ({selectedBasics.length} selected)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${campingBasicsOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Common camping items you may need
            </p>
            {CAMPING_BASICS.map((basic) => {
              const isSelected = selectedBasics.includes(basic.id);
              return (
                <div
                  key={basic.id}
                  className="flex items-center gap-3 p-2 rounded-md"
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
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-3 justify-end">
          <Button
            onClick={handleShare}
            disabled={neededCount === 0 || createShareLinkMutation.isPending}
            data-testid="button-share"
          >
            {createShareLinkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </>
            )}
          </Button>
        </div>

        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogContent data-testid="dialog-share">
            <DialogHeader>
              <DialogTitle>Share Your List</DialogTitle>
              <DialogDescription>
                Share this link with friends or family
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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

              <div className="border-t pt-4">
                <div className="flex items-center gap-2">
                  <input
                    id="email-input"
                    type="email"
                    placeholder="friend@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendViaEmail()}
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                    data-testid="input-email-address"
                  />
                  <Button
                    onClick={sendViaEmail}
                    variant="default"
                    disabled={!emailAddress}
                    data-testid="button-send-email"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
