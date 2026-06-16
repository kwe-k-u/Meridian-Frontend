import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'google'
  children: ReactNode
}

function Button({ variant = 'primary', className = '', children, ...rest }: Props) {
  return (
    <button
      className={`auth-button${variant === 'google' ? ' auth-button-google' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export default Button
