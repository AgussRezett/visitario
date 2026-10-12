/** "Agustín", "Rezett" -> "AR". */
export function initials(firstName: string, lastName: string) {
  return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase()
}
