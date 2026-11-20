import type { JSX, ReactNode } from 'react';

import { cn } from '@sylvie/utils';

export interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}

/** 表单字段：标签 + 控件。 */
export function Field({ label, htmlFor, required, children }: FieldProps): JSX.Element {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

export function TextInput({
  className,
  ...rest
}: React.ComponentPropsWithRef<'input'>): JSX.Element {
  return <input type="text" className={cn('input', className)} {...rest} />;
}

export function TextArea({
  className,
  ...rest
}: React.ComponentPropsWithRef<'textarea'>): JSX.Element {
  return <textarea className={cn('textarea', className)} {...rest} />;
}

export function Select({
  className,
  ...rest
}: React.ComponentPropsWithRef<'select'>): JSX.Element {
  return <select className={cn('select', className)} {...rest} />;
}
