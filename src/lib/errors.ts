// Kutilgan xatolar: mijozga ko'rsatiladigan xabar + HTTP kodi.
// Kutilmagan xatolar error middleware'da 500 bo'lib, batafsiloti faqat log'ga tushadi.
export class AppError extends Error {
  constructor(
    readonly status: number,
    override readonly message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, "BAD_REQUEST", details);

export const unauthorized = (message = "Avtorizatsiya talab qilinadi") =>
  new AppError(401, message, "UNAUTHORIZED");

export const forbidden = (message = "Ruxsat yo'q") => new AppError(403, message, "FORBIDDEN");

export const notFound = (message = "Topilmadi") => new AppError(404, message, "NOT_FOUND");

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, message, "CONFLICT", details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, message, "UNPROCESSABLE", details);
