import RecipeForm from '../RecipeForm'

export default function RecipeFormExample() {
  return (
    <RecipeForm
      onSubmit={(recipe) => console.log('Recipe created:', recipe)}
    />
  )
}
