import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { getSessionFn } from '#/server/session'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { MoreHorizontal } from 'lucide-react'

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
    if (session.user.role !== 'admin') throw redirect({ to: '/' })
  },
  component: AdminUsersPage,
})

type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  banned: boolean | null
  createdAt: Date | string
}

function AdminUsersPage() {
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()
  const currentUserId = session?.user.id

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  const { data: usersData, isLoading, error: listError } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: { limit: 100, sortBy: 'createdAt', sortDirection: 'desc' },
      })
      if (result.error) throw new Error(result.error.message ?? 'Failed to load users')
      return result.data
    },
  })

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'user' | 'admin' }) =>
      authClient.admin.setRole({ userId, role }),
    onSuccess: invalidateUsers,
  })

  const banMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      authClient.admin.banUser({ userId }),
    onSuccess: invalidateUsers,
  })

  const unbanMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      authClient.admin.unbanUser({ userId }),
    onSuccess: invalidateUsers,
  })

  const deleteMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      authClient.admin.removeUser({ userId }),
    onSuccess: () => {
      setDeleteTarget(null)
      invalidateUsers()
    },
  })

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', role: 'user' as 'user' | 'admin' },
    onSubmit: async ({ value }) => {
      setCreateError(null)
      setCreateSuccess(null)
      const result = await authClient.admin.createUser({
        name: value.name,
        email: value.email,
        password: value.password,
        role: value.role,
      })
      if (result.error) {
        setCreateError(result.error.message ?? 'Failed to create user')
      } else {
        setCreateSuccess(`Created ${value.email} — share the password you set with them.`)
        form.reset()
        invalidateUsers()
      }
    },
  })

  const users: AdminUser[] = (usersData?.users as AdminUser[] | undefined) ?? []

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">User management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-1">
                    <Label htmlFor="new-name">Name</Label>
                    <Input
                      id="new-name"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-1">
                    <Label htmlFor="new-email">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-1">
                    <Label htmlFor="new-password">Temp password</Label>
                    <Input
                      id="new-password"
                      type="text"
                      autoComplete="off"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required
                      minLength={4}
                    />
                  </div>
                )}
              </form.Field>
              <form.Field name="role">
                {(field) => (
                  <div className="space-y-1">
                    <Label>Role</Label>
                    <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as 'user' | 'admin')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            {createSuccess && <p className="text-sm text-green-600">{createSuccess}</p>}
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create account'}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {listError && (
            <p className="text-sm text-destructive">{listError.message}</p>
          )}
          {!isLoading && !listError && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentUserId
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.banned ? (
                          <Badge variant="destructive">Banned</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Active</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isSelf}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {u.role !== 'admin' ? (
                              <DropdownMenuItem
                                onClick={() => setRoleMutation.mutate({ userId: u.id, role: 'admin' })}
                              >
                                Make admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setRoleMutation.mutate({ userId: u.id, role: 'user' })}
                              >
                                Remove admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {u.banned ? (
                              <DropdownMenuItem
                                onClick={() => unbanMutation.mutate({ userId: u.id })}
                              >
                                Unban
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => banMutation.mutate({ userId: u.id })}
                              >
                                Ban
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(u)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.email}</strong>? This cannot be undone —
              all their pantry items and grocery lists will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate({ userId: deleteTarget.id })
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
