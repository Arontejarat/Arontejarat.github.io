import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost' | 'accent' | 'link'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow] duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-800 text-white shadow-xs hover:bg-brand-900 active:bg-brand-950 focus-visible:outline-brand-500',
  accent: 'bg-accent-600 text-white shadow-xs hover:bg-accent-700 active:bg-accent-800 focus-visible:outline-accent-500',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 focus-visible:outline-brand-500',
  outline: 'border border-ink-200 bg-white text-ink-800 shadow-xs hover:bg-ink-50 hover:border-ink-300 active:bg-ink-100 focus-visible:outline-brand-500',
  ghost: 'text-ink-700 hover:bg-ink-100 active:bg-ink-200 focus-visible:outline-brand-500',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 focus-visible:outline-red-500',
  'danger-ghost': 'text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:outline-red-500',
  link: 'text-brand-700 underline-offset-4 hover:underline hover:text-brand-900 px-0! h-auto!',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-sm',
  sm: 'h-9 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-base rounded-lg',
}

const iconSize: Record<ButtonSize, number> = { xs: 14, sm: 16, md: 18, lg: 20 }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: LucideIcon
  iconEnd?: LucideIcon
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, iconEnd: IconEnd, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <LoaderCircle size={iconSize[size]} className="animate-spin" aria-hidden /> : Icon ? <Icon size={iconSize[size]} aria-hidden /> : null}
      {children}
      {IconEnd && !loading ? <IconEnd size={iconSize[size]} aria-hidden /> : null}
    </button>
  )
})

export interface ButtonLinkProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconEnd?: LucideIcon
  block?: boolean
  className?: string
}

export function ButtonLink({ variant = 'primary', size = 'md', icon: Icon, iconEnd: IconEnd, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], block && 'w-full', className)} {...rest}>
      {Icon ? <Icon size={iconSize[size]} aria-hidden /> : null}
      {children as ReactNode}
      {IconEnd ? <IconEnd size={iconSize[size]} aria-hidden /> : null}
    </Link>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Accessible name — required because the button has no visible text */
  label: string
  variant?: 'ghost' | 'outline' | 'secondary' | 'danger-ghost' | 'primary'
  size?: 'sm' | 'md' | 'lg'
  badge?: number
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'md', className, badge, type = 'button', ...rest },
  ref,
) {
  const dim = size === 'sm' ? 'size-9' : size === 'lg' ? 'size-12' : 'size-10'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], dim, 'rounded-md p-0', className)}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 20} aria-hidden />
      {badge ? (
        <span className="absolute -top-0.5 -end-0.5 grid min-w-[18px] h-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
          {badge > 99 ? '۹۹+' : new Intl.NumberFormat('fa-IR').format(badge)}
        </span>
      ) : null}
    </button>
  )
})
