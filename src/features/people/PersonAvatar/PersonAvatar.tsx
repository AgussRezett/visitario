import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { usePersonPhoto } from '@/features/people/photos'

interface PersonAvatarProps {
  personId: string | null | undefined
  firstName: string
  lastName?: string | null
  size?: number
  className?: string
}

/** A person's profile photo, or their initials when they have not set one. */
export function PersonAvatar({ personId, firstName, lastName, size, className }: PersonAvatarProps) {
  const photo = usePersonPhoto(personId)
  return <Avatar name={initials(firstName, lastName ?? '')} src={photo} size={size} className={className} />
}
