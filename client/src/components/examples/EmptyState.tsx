import EmptyState from '../EmptyState'

export default function EmptyStateExample() {
  return (
    <EmptyState
      message="No recipes yet. Create your first camping recipe!"
      actionLabel="Create Recipe"
      onAction={() => console.log('Create recipe clicked')}
    />
  )
}
