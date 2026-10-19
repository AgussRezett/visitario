import { createFileRoute } from '@tanstack/react-router'
import { InvitationPage } from '@/features/invitations/pages/InvitationPage'

// The email's link. Open to anyone: the page shows the invitation and how to go on.
export const Route = createFileRoute('/invitacion/$token')({
  component: function Invitation() {
    const { token } = Route.useParams()
    return <InvitationPage token={token} />
  },
})
