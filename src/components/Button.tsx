import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'google'
  children: ReactNode
}

function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button
      className={`btn${variant === 'google' ? ' btn-outline' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export default Button
