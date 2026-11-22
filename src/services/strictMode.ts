let strict = false;

/** Strict mode disables Typeleft/Typora extensions while keeping GFM. */
export const setStrictMode = (value: unknown) => {
  strict = value === true;
};

export const isStrictMode = () => strict;
