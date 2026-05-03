import { useState } from 'react'
import { toast } from 'sonner'
import { updateFoodTags } from '#/server/functions/food'
import { normalizeTag } from '#/lib/tags'
import { queryClient } from '#/integrations/tanstack-query/root-provider'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

type FoodTagsEditorProps = {
  foodId: string
  tags: string[]
}

export default function FoodTagsEditor({ foodId, tags }: FoodTagsEditorProps) {
  const [localTags, setLocalTags] = useState<string[]>(tags)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveTags(next: string[]) {
    const prev = localTags
    setLocalTags(next)
    setSaving(true)
    try {
      await updateFoodTags({ data: { id: foodId, tags: next } })
      // Invalidate the pantry collection so updated tags are reflected in the
      // virtualised list without a full page reload. The pantry collection is
      // registered with queryKey ['pantry'] in src/db-collections/index.ts.
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
    } catch {
      toast.error('Failed to update tags')
      setLocalTags(prev)
    } finally {
      setSaving(false)
    }
  }

  function handleAdd() {
    const normalized = normalizeTag(inputValue)
    if (!normalized) return
    const alreadyExists = localTags.some(
      (t) => t.toLowerCase() === normalized.toLowerCase(),
    )
    if (alreadyExists) {
      setInputValue('')
      return
    }
    setInputValue('')
    void saveTags([...localTags, normalized])
  }

  function handleRemove(tag: string) {
    void saveTags(localTags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      {localTags.length === 0 && !inputValue ? (
        <p className="text-xs text-muted-foreground mb-2">No tags</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {localTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                disabled={saving}
                className="text-muted-foreground hover:text-foreground leading-none"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="flex-1"
          placeholder="Add tag…"
          value={inputValue}
          disabled={saving}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="sm"
          disabled={saving || !inputValue.trim()}
          onClick={handleAdd}
        >
          Add
        </Button>
      </div>
    </div>
  )
}
