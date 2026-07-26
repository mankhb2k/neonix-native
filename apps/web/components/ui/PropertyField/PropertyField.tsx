"use client";

import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PropertySectionProps {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PropertySection({
  title,
  action,
  children,
  className,
}: PropertySectionProps) {
  return (
    <section className={cn("border-b border-[var(--line)] px-3 py-3", className)}>
      <div className="mb-2 flex h-6 items-center justify-between">
        <h3 className="text-body font-semibold text-[var(--fg)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface PropertyLabelProps {
  children: ReactNode;
  className?: string;
}

export function PropertyLabel({ children, className }: PropertyLabelProps) {
  return (
    <span
      className={cn("mb-1 block text-caption text-[var(--fg-muted)]", className)}
    >
      {children}
    </span>
  );
}

export interface PropertyRowProps {
  children: ReactNode;
  className?: string;
}

export function PropertyRow({ children, className }: PropertyRowProps) {
  return <div className={cn("flex gap-2", className)}>{children}</div>;
}

export interface PropertyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  prefix?: string;
  stepper?: boolean;
}

export function PropertyInput({
  id,
  label,
  prefix,
  stepper = false,
  className,
  disabled,
  step,
  min,
  max,
  value,
  defaultValue,
  onChange,
  ...props
}: PropertyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function adjust(direction: 1 | -1) {
    if (disabled) return;

    const stepSize = Number(step ?? 1) || 1;
    const minVal = min !== undefined && min !== "" ? Number(min) : -Infinity;
    const maxVal = max !== undefined && max !== "" ? Number(max) : Infinity;
    const current = Number(
      value ?? inputRef.current?.value ?? defaultValue ?? 0,
    );
    const raw = (Number.isFinite(current) ? current : 0) + direction * stepSize;
    const next = Math.min(maxVal, Math.max(minVal, raw));
    const nextValue = String(next);

    if (onChange) {
      onChange({
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as ChangeEvent<HTMLInputElement>);
      return;
    }

    if (inputRef.current) {
      inputRef.current.value = nextValue;
    }
  }

  return (
    <label className={cn("flex min-w-0 flex-1 flex-col", className)}>
      {label ? <PropertyLabel>{label}</PropertyLabel> : null}
      <div className="flex items-stretch gap-0.5">
        <div className="flex min-w-0 flex-1 items-center rounded-[4px] bg-[var(--bg-hover)] py-1.5">
          {prefix ? (
            <div className="flex shrink-0 items-center self-center pl-2">
              <span className="select-none text-ui font-regular leading-none text-[var(--fg-muted)]">
                {prefix}
              </span>
            </div>
          ) : null}
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center self-center",
              prefix ? "px-1.5" : "px-2",
            )}
          >
            <input
              ref={inputRef}
              id={id}
              disabled={disabled}
              step={step}
              min={min}
              max={max}
              value={value}
              defaultValue={defaultValue}
              onChange={onChange}
              className="w-full min-w-0 bg-transparent p-0 text-ui font-regular leading-none text-[var(--fg)] outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              {...props}
            />
          </div>
        </div>

        {stepper ? (
          <div className="flex w-5 shrink-0 flex-col overflow-hidden rounded-[4px] bg-[var(--bg-hover)]">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Tăng"
              className="flex flex-1 items-center justify-center text-[var(--fg-muted)] disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                adjust(1);
              }}
            >
              <ChevronUp size={10} strokeWidth={2} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Giảm"
              className="flex flex-1 items-center justify-center text-[var(--fg-muted)] disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                adjust(-1);
              }}
            >
              <ChevronDown size={10} strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
    </label>
  );
}

export interface PropertySelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function PropertySelect({
  id,
  label,
  children,
  className,
  ...props
}: PropertySelectProps) {
  return (
    <label className={cn("flex min-w-0 flex-1 flex-col", className)}>
      {label ? <PropertyLabel>{label}</PropertyLabel> : null}
      <div className="relative flex items-center rounded-[4px] bg-[var(--bg-hover)] px-2 py-1.5">
        <select
          id={id}
          className="h-full w-full appearance-none bg-transparent pr-5 text-ui font-regular leading-none text-[var(--fg)] outline-none disabled:opacity-40"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 text-[var(--fg-muted)]"
        />
      </div>
    </label>
  );
}

export interface PropertyColorProps {
  id?: string;
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function PropertyColor({
  id,
  label,
  value,
  onChange,
  className,
}: PropertyColorProps) {
  return (
    <label className={cn("flex min-w-0 flex-col", className)}>
      {label ? <PropertyLabel>{label}</PropertyLabel> : null}
      <div className="flex items-center gap-2 rounded-[4px] bg-[var(--bg-hover)] px-2 py-1.5">
        <input
          id={id}
          type="color"
          className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <span className="truncate text-ui font-regular leading-none uppercase text-[var(--fg)]">
          {value}
        </span>
      </div>
    </label>
  );
}

export interface PropertyIconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function PropertyIconButton({
  label,
  children,
  className,
  ...props
}: PropertyIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-[4px] text-[var(--fg-muted)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
