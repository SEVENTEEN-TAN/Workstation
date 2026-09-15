interface FieldErrorProps {
  id: string;
  path: string;
  message?: string;
}

export function FieldError({ id, path, message }: FieldErrorProps) {
  if (!message) return null;

  return (
    <span id={id} role="alert">
      {path}: {message}
    </span>
  );
}
