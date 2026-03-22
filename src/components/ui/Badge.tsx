import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "amber";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono uppercase tracking-wider"
  
  const variants = {
    default: "border-transparent bg-[var(--color-primary)] text-white shadow hover:opacity-80",
    secondary: "border-transparent bg-[var(--color-elevated)] text-[var(--color-cream)] hover:opacity-80",
    destructive: "border-transparent bg-[var(--color-danger)] text-[#0f1117] shadow hover:opacity-80",
    outline: "text-[var(--color-muted)] border-[var(--color-border)]",
    success: "border-transparent bg-[var(--color-success)] text-[#0f1117] shadow hover:opacity-80",
    amber: "border-transparent bg-[var(--color-amber)] text-[#0f1117] shadow hover:opacity-80",
  }

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  )
}

export { Badge }
