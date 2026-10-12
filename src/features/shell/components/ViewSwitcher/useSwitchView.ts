import { useNavigate } from '@tanstack/react-router'
import type { ViewOption } from '@/domain/roles'
import { setActiveRole } from '@/features/auth/active-role'

/** Opens another company or role and lands on its first section. */
export function useSwitchView() {
  const navigate = useNavigate()
  return (view: ViewOption) => {
    setActiveRole(view)
    void navigate({ to: '/' })
  }
}
