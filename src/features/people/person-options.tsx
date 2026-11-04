import type { SelectOption } from '@/ui/Select'
import { PersonAvatar } from './PersonAvatar'

/** A person in a filter: their photo (or initials) in a circle, left of the name. */
export const personOption = (id: string, first: string, last: string): SelectOption => ({
  value: id,
  label: `${first} ${last}`.trim(),
  leading: <PersonAvatar personId={id} firstName={first} lastName={last} size={24} />,
})

/** A seller in a filter: their photo when they have a Visitario user, else their initials. */
export const sellerOption = (s: { id: number; name: string; personId: string | null }): SelectOption => {
  const [first = '', ...rest] = s.name.split(' ')
  return { value: String(s.id), label: s.name, leading: <PersonAvatar personId={s.personId} firstName={first} lastName={rest.join(' ')} size={24} /> }
}
