import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Gradient variant — uses the brand gradient CSS variable
        gradient:
          "text-white hover:opacity-90 active:opacity-100",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-full px-3",
        lg: "h-10 rounded-full px-6",
        // icon keeps rounded-xl (not a full circle) per spec
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** When true: disables the button and shows a spinner alongside children. */
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  // Inline style for the gradient variant (can't put a CSS var inside a class value directly in Tailwind v4 JIT)
  const gradientStyle =
    variant === "gradient"
      ? { background: "var(--gradient-brand)", ...style }
      : style;

  // With asChild, Radix Slot requires EXACTLY ONE child — so we must pass
  // `children` straight through (no spinner sibling, no `disabled` on the slotted
  // element, which is often an <a>). The spinner/disabled only apply to a real
  // <button>.
  if (asChild) {
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} style={gradientStyle} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      style={gradientStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
      {children}
    </Comp>
  );
}

export { Button, buttonVariants };
