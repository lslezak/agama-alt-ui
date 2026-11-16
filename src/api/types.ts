/** RFC 9457 problem details as returned by the Agama server. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
}

export interface ProductMode {
  id: string;
  name: string;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  icon: string;
  registration: boolean;
  licenses: string[];
  desktopSelection?: "optional" | "suggested";
  modes: ProductMode[];
}

export interface HardwareInfo {
  cpu?: string;
  /** Memory size in bytes. */
  memory?: number;
  model?: string;
}

/** The subset of `GET /api/system` used by this UI. */
export interface SystemInfo {
  products: Product[];
  hardware?: HardwareInfo;
}

/** The subset of `GET /api/config` used by this UI. */
export interface Config {
  product?: { id?: string };
}
