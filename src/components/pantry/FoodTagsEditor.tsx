import { useState } from 'react'
import { toast } from 'sonner'
import { updateFoodTags } from '#/server/functions/food'
import { normalizeTag } from '#/lib/tags'
import { queryClient } from '#/integrations/tanstack-query/root-provider'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'

type FoodTagsEditorProps =
  | { mode?: 'server'; foodId: string; tags: string[] }
  | { mode: 'controlled'; tags: string[]; onChange: (next: string[]) => void }

export default function FoodTagsEditor(props: FoodTagsEditorProps) {
  const isControlled = props.mode === 'controlled'
  const [serverTags, setServerTags] = useState<string[]>(isControlled ? [] : (props as { tags: string[] }).tags)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)

  const currentTags = isControlled ? props.tags : serverTags

  async function saveTags(next: string[]) {
    if (isControlled) {
      props.onChange(next)
      return
    }
    const { foodId } = props as { foodId: string; tags: string[] }
    const prev = serverTags
    setServerTags(next)
    setSaving(true)
    try {
      await updateFoodTags({ data: { id: foodId, tags: next } })
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
    } catch {
      toast.error('Failed to update tags')
      setServerTags(prev)
    } finally {
      setSaving(false)
    }
  }

  function handleAdd() {
    const normalized = normalizeTag(inputValue)
    if (!normalized) return
    const alreadyExists = currentTags.some(
      (t) => t.toLowerCase() === normalized.toLowerCase(),
    )
    if (alreadyExists) {
      setInputValue('')
      return
    }
    setInputValue('')
    void saveTags([...currentTags, normalized])
  }

  function handleRemove(tag: string) {
    void saveTags(currentTags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      {currentTags.length === 0 && !inputValue ? (
        <p className="text-xs text-muted-foreground mb-2">No tags</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {currentTags.map((tag) => (
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
