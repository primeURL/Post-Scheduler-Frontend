import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:scale-[0.98]";
    
    const variants = {
      default: "bg-[var(--color-primary)] text-white shadow hover:opacity-90 shadow-[var(--color-primary)]/10",
      destructive: "bg-[var(--color-danger)] text-[#0f1117] shadow-sm hover:opacity-90",
      outline: "border border-[var(--color-border)] bg-transparent shadow-sm hover:bg-[var(--color-elevated)] text-[var(--color-cream)]",
      secondary: "bg-[var(--color-elevated)] text-[var(--color-cream)] shadow-sm hover:opacity-90",
      ghost: "hover:bg-[var(--color-elevated)] text-[var(--color-cream)]",
      link: "text-[var(--color-accent)] underline-offset-4 hover:underline pr-0 pl-0 h-auto",
    };

    const sizes = {
      default: "h-11 px-6 py-2 rounded-xl",
      sm: "h-9 rounded-lg px-4 text-xs",
      lg: "h-12 rounded-xl px-10 text-base",
      icon: "h-10 w-10",
    };

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
