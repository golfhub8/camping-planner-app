import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PackageIcon, PlusIcon, TrashIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TripPackingItem } from "@shared/schema";

interface TripPackingListProps {
  tripId: number;
}

export default function TripPackingList({ tripId }: TripPackingListProps) {
  const [newItemName, setNewItemName] = useState("");
  const { toast } = useToast();

  const { data: packingItems = [], isLoading } = useQuery<TripPackingItem[]>({
    queryKey: ["/api/trips", tripId, "packing"],
  });

  const addItemMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", `/api/trips/${tripId}/packing`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "packing"] });
      setNewItemName("");
      toast({
        title: "Item Added",
        description: "Packing item added to your list",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add item",
      });
    },
  });

  const togglePackedMutation = useMutation({
    mutationFn: ({ itemId, packed }: { itemId: number; packed: boolean }) =>
      apiRequest("PATCH", `/api/trips/${tripId}/packing/${itemId}`, { packed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "packing"] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) =>
      apiRequest("DELETE", `/api/trips/${tripId}/packing/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "packing"] });
      toast({
        title: "Item Removed",
        description: "Packing item removed from your list",
      });
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemName.trim()) {
      addItemMutation.mutate(newItemName.trim());
    }
  };

  const handleTogglePacked = (itemId: number, currentPacked: boolean) => {
    togglePackedMutation.mutate({ itemId, packed: !currentPacked });
  };

  const handleDeleteItem = (itemId: number) => {
    deleteItemMutation.mutate(itemId);
  };

  const packedCount = packingItems.filter(item => item.packed).length;
  const totalCount = packingItems.length;

  return (
    <Card data-testid="card-packing-list">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-primary" />
            <CardTitle>Things to Pack</CardTitle>
          </div>
          {totalCount > 0 && (
            <div className="text-sm text-muted-foreground" data-testid="text-packing-progress">
              {packedCount} / {totalCount} packed
            </div>
          )}
        </div>
        <CardDescription>
          Keep track of what you need to bring on your camping trip
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAddItem} className="flex gap-2">
          <Input
            type="text"
            placeholder="Add an item to pack..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            disabled={addItemMutation.isPending}
            data-testid="input-new-packing-item"
          />
          <Button
            type="submit"
            disabled={!newItemName.trim() || addItemMutation.isPending}
            data-testid="button-add-packing-item"
          >
            {addItemMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
          </Button>
        </form>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : packingItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <PackageIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No packing items yet</p>
            <p className="text-sm">Add items you need to bring on your trip</p>
          </div>
        ) : (
          <div className="space-y-2">
            {packingItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate transition-all"
                data-testid={`packing-item-${item.id}`}
              >
                <Checkbox
                  checked={item.packed}
                  onCheckedChange={() => handleTogglePacked(item.id, item.packed)}
                  disabled={togglePackedMutation.isPending}
                  data-testid={`checkbox-packing-item-${item.id}`}
                />
                <span
                  className={`flex-1 ${
                    item.packed ? "line-through text-muted-foreground" : ""
                  }`}
                  data-testid={`text-packing-item-${item.id}`}
                >
                  {item.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={deleteItemMutation.isPending}
                  data-testid={`button-delete-packing-item-${item.id}`}
                >
                  <TrashIcon className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
