import { useState } from 'react'
import { Check, Copy, MailCheck, MailWarning, MessageCircle } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { INVITE_MINUTES, inviteMessage } from '@/domain/invitations'
import { whatsappLink } from '@/domain/people'
import { Banner } from '@/ui/Banner'
import { Button, buttonClass } from '@/ui/Button'
import type { SentInvitation } from '@/features/invitations/api'
import styles from './InviteLink.module.scss'

interface InviteLinkProps {
  result: SentInvitation
  email: string
  company: string
}

/** After inviting or resending: whether the email went out, and the link to share it anyway. */
export function InviteLink({ result, email, company }: InviteLinkProps) {
  const [copied, setCopied] = useState(false)
  const until = formatTime(new Date(Date.now() + INVITE_MINUTES * 60_000).toISOString())
  const message = inviteMessage(company, result.link)
  const copy = async () => {
    await navigator.clipboard?.writeText(result.link).catch(() => null)
    setCopied(true)
  }

  return (
    <div className={styles.box}>
      {result.sent ? (
        <Banner tone="ok" icon={<MailCheck size={18} aria-hidden />} title={`Le mandamos la invitación a ${email}`}>
          El enlace vence en 1 hora, a las {until}. Si no le llega, mandáselo por WhatsApp.
        </Banner>
      ) : (
        <Banner tone="warn" icon={<MailWarning size={18} aria-hidden />} title="No pudimos mandar el mail">
          La invitación está creada: mandale el enlace por WhatsApp. Vence en 1 hora, a las {until}.
        </Banner>
      )}
      <p className={styles.link}>{result.link}</p>
      <div className={styles.actions}>
        <a className={buttonClass(result.sent ? 'secondary' : 'primary', 'md')} href={whatsappLink(message)} target="_blank" rel="noreferrer">
          <MessageCircle size={18} aria-hidden />Mandar por WhatsApp
        </a>
        <Button variant="secondary" size="md" onClick={() => void copy()}>
          {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}{copied ? 'Enlace copiado' : 'Copiar enlace'}
        </Button>
      </div>
    </div>
  )
}
