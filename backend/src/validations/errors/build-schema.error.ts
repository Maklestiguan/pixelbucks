export class BuildSchemaError extends Error {
  constructor({ className }: { className: string }) {
    super(
      `Validation schema not compiled for ${className}. Did you forget to add @Dto() decorator?`,
    );
    this.name = 'BuildSchemaError';
  }
}
