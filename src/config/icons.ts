import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Award,
  Baby,
  BadgeCheck,
  Briefcase,
  Calculator,
  CalendarDays,
  ClipboardList,
  Clock,
  FileCheck2,
  FileText,
  HandCoins,
  HeartPulse,
  IdCard,
  Landmark,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  ShieldCheck,
  Siren,
  User,
  Users,
  Wallet,
} from 'lucide-react'

/** Serializable icon keys (used by configurable catalogues) → icon components */
export const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  coins: HandCoins,
  receipt: Receipt,
  calculator: Calculator,
  calendar: CalendarDays,
  clock: Clock,
  heart: HeartPulse,
  clipboard: ClipboardList,
  user: User,
  users: Users,
  baby: Baby,
  idcard: IdCard,
  bank: Landmark,
  briefcase: Briefcase,
  arrows: ArrowLeftRight,
  badge: BadgeCheck,
  award: Award,
  filecheck: FileCheck2,
  shield: ShieldCheck,
  package: Package,
  siren: Siren,
  message: MessageSquare,
  logout: LogOut,
  file: FileText,
}

export function iconFor(key: string | undefined): LucideIcon {
  return (key && ICONS[key]) || FileText
}
