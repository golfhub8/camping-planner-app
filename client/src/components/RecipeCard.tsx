import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChefHat, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecipeCardProps {
  id: number;
  title: string;
  ingredients: string[];
  createdAt: Date;
}

export default function RecipeCard({ id, title, ingredients, createdAt }: RecipeCardProps) {
  const displayIngredients = ingredients.slice(0, 3);
  const hasMore = ingredients.length > 3;

  return (
    <Card className="hover-elevate transition-all" data-testid={`card-recipe-${id}`}>
      <CardHeader className="space-y-3">
        <CardTitle className="line-clamp-2 text-xl font-serif" data-testid={`text-recipe-title-${id}`}>
          {title}
        </CardTitle>
        <Badge variant="secondary" className="w-fit gap-1" data-testid={`badge-ingredient-count-${id}`}>
          <ChefHat className="h-3 w-3" />
          {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <ul className="space-y-1 text-sm text-muted-foreground">
          {displayIngredients.map((ingredient, idx) => (
            <li key={idx} className="flex items-start gap-2" data-testid={`text-ingredient-${id}-${idx}`}>
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
              <span className="line-clamp-1">{ingredient}</span>
            </li>
          ))}
          {hasMore && (
            <li className="text-xs text-muted-foreground pl-3">
              +{ingredients.length - 3} more
            </li>
          )}
        </ul>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`text-created-${id}`}>
          <Calendar className="h-3.5 w-3.5" />
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </div>
        <Link href={`/recipe/${id}`} data-testid={`link-view-recipe-${id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-4 w-4" />
            View Recipe
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
