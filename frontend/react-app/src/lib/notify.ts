import { sileo } from "sileo";

const successStyles = {
  title: "text-white! font-semibold!",
  description: "text-emerald-400!",
  badge: "bg-emerald-500/20! text-emerald-400!",
};

const errorStyles = {
  title: "text-red-400! font-semibold!",
  description: "text-white!",
  badge: "bg-red-500/20! text-red-400!",
};

const fill = "#0f172a";

export const notify = {
  success(title: string, description?: string) {
    sileo.success({ title, description, fill, styles: successStyles });
  },

  error(title: string, description?: string) {
    sileo.error({ title, description, fill, styles: errorStyles });
  },

  promise<T>(
    promise: Promise<T>,
    opts: {
      loading: string;
      success: string | ((data: T) => string);
      successDesc?: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
      errorDesc?: string | ((err: unknown) => string);
    }
  ) {
    return sileo.promise(promise, {
      loading: { title: opts.loading },
      success: (data) => ({
        title: typeof opts.success === "function" ? opts.success(data) : opts.success,
        description: opts.successDesc
          ? typeof opts.successDesc === "function"
            ? opts.successDesc(data)
            : opts.successDesc
          : undefined,
        fill,
        styles: successStyles,
      }),
      error: (err) => ({
        title: typeof opts.error === "function" ? opts.error(err) : opts.error,
        description: opts.errorDesc
          ? typeof opts.errorDesc === "function"
            ? opts.errorDesc(err)
            : opts.errorDesc
          : err instanceof Error
          ? err.message
          : undefined,
        fill,
        styles: errorStyles,
      }),
    });
  },
};
