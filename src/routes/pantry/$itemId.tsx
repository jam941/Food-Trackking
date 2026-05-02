import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { getSessionFn } from '#/server/session'
import { updatePantryItem } from '#/server/functions/pantry'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { UNITS, UNIT_LABELS } from '#/lib/units'

export const Route = createFileRoute('/pantry/$itemId')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
  },
  component: EditPantryItemPage,
})

function EditPantryItemPage() {
  const { itemId } = Route.useParams()
  const router = useRouter()

  const form = useForm({
    defaultValues: {
      quantity: 1,
      unit: 'g' as (typeof UNITS)[number],
      location: 'pantry' as 'pantry' | 'fridge' | 'freezer' | 'other',
      expiresAt: '',
      note: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await updatePantryItem({
          data: {
            id: itemId,
            data: {
              quantity: value.quantity,
              unit: value.unit,
              location: value.location,
              expiresAt: value.expiresAt || undefined,
              note: value.note || undefined,
            },
          },
        })
        toast.success('Updated')
        await router.navigate({ to: '/pantry' })
      } catch {
        toast.error('Failed to update')
      }
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          ← Back
        </Button>
        <h1 className="text-xl font-bold">Edit pantry item</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void form.handleSubmit() }}
        className="space-y-4"
      >
        <form.Field name="quantity">
          {(field) => (
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="unit">
          {(field) => (
            <div className="space-y-1">
              <Label>Unit</Label>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as (typeof UNITS)[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{UNIT_LABELS[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="location">
          {(field) => (
            <div className="space-y-1">
              <Label>Storage location</Label>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'pantry' | 'fridge' | 'freezer' | 'other')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pantry">Pantry</SelectItem>
                  <SelectItem value="fridge">Fridge</SelectItem>
                  <SelectItem value="freezer">Freezer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="expiresAt">
          {(field) => (
            <div className="space-y-1">
              <Label>Expiry date (optional)</Label>
              <Input
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="note">
          {(field) => (
            <div className="space-y-1">
              <Label>Note (optional)</Label>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}
