import RecipeCard from '../RecipeCard'

export default function RecipeCardExample() {
  return (
    <RecipeCard
      id={1}
      title="Campfire Chili"
      ingredients={["Ground beef", "Kidney beans", "Tomatoes", "Onions", "Chili powder", "Cumin"]}
      createdAt={new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)}
    />
  )
}
