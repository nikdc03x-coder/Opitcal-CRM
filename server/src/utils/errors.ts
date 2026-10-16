export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class OrderInputError extends HttpError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode);
    this.name = "OrderInputError";
  }
}

export class CatalogSelectionError extends HttpError {
  constructor(message: string) {
    super(message);
    this.name = "CatalogSelectionError";
  }
}
