import { createFileRoute } from '@tanstack/react-router'
import { useMe } from '@/features/auth/me'
import { ProfilePage } from '@/features/profile/ProfilePage'

export const Route = createFileRoute('/_app/profile')({
  component: function Profile() {
    const { data: me } = useMe()
    return me?.person ? <ProfilePage me={{ ...me, person: me.person }} /> : null
  },
})
