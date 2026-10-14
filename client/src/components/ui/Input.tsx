import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { CONTROL_CLASS } from "./control";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, type = "text", ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(CONTROL_CLASS, className)}
        {...props}
      />
    );
  },
);
