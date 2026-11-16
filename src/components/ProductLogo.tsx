import { useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { Product } from "../api/types";
import { useUi } from "../context/UiContext";

/**
 * Product logo served by the Agama server (`/assets/logos/<icon>`). Tries the dark variant in the
 * dark theme, then the plain one, and finally falls back to a generated placeholder.
 */
export function ProductLogo({
  client,
  product,
  size = 72,
}: {
  client: ApiClient;
  product: Product;
  size?: number;
}) {
  const { theme } = useUi();
  const sources = product.icon
    ? theme === "dark"
      ? [client.logoUrl(product.icon, true), client.logoUrl(product.icon)]
      : [client.logoUrl(product.icon)]
    : [];
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [theme, product.id, product.icon]);

  if (index >= sources.length) {
    return (
      <div className="product-logo product-logo--fallback" style={{ width: size, height: size }}>
        {product.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      className="product-logo"
      src={sources[index]}
      alt=""
      width={size}
      height={size}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
