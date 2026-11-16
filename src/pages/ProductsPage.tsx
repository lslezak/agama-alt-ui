import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  EmptyStateBody,
  Label,
} from "@patternfly/react-core";
import ArrowLeftIcon from "@patternfly/react-icons/dist/esm/icons/arrow-left-icon";
import KeyIcon from "@patternfly/react-icons/dist/esm/icons/key-icon";
import MemoryIcon from "@patternfly/react-icons/dist/esm/icons/memory-icon";
import MicrochipIcon from "@patternfly/react-icons/dist/esm/icons/microchip-icon";
import DesktopIcon from "@patternfly/react-icons/dist/esm/icons/desktop-icon";
import { motion, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion";
import { useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import type { ApiClient } from "../api/client";
import type { HardwareInfo, Product } from "../api/types";
import { Loader } from "../components/Loader";
import { ProductLogo } from "../components/ProductLogo";
import { useSession } from "../context/SessionContext";
import { formatBytes } from "../utils/format";

type Data =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; products: Product[]; hardware?: HardwareInfo; current?: string };

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.85 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 140, damping: 14 } },
};

function ProductCard({
  client,
  product,
  selected,
  onSelect,
}: {
  client: ApiClient;
  product: Product;
  selected: boolean;
  onSelect: () => void;
}) {
  // 3D tilt following the mouse
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 200, damping: 18 };
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [9, -9]), spring);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), spring);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      variants={cardVariants}
      className="product-wrap"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.98 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onSelect}
    >
      <Card
        isSelectable
        isSelected={selected}
        className={selected ? "product-card product-card--selected" : "product-card"}
      >
        <CardBody className="product-card__logo">
          <ProductLogo client={client} product={product} />
        </CardBody>
        <CardTitle>{product.name}</CardTitle>
        <CardBody>
          {/* plain text from the server, never rendered as HTML */}
          <p className="product-card__description">{product.description}</p>
        </CardBody>
        <CardBody className="product-card__badges">
          {product.registration && (
            <Label color="orange" icon={<KeyIcon />} isCompact>
              registration required
            </Label>
          )}
          {product.licenses.length > 0 && (
            <Label color="purple" isCompact>
              license
            </Label>
          )}
          {product.modes.length > 1 && (
            <Label color="blue" isCompact>
              {product.modes.length} modes
            </Label>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}

function Hardware({ hardware }: { hardware: HardwareInfo }) {
  return (
    <div className="hardware">
      {hardware.model && (
        <Label icon={<DesktopIcon />} variant="outline" isCompact>
          {hardware.model}
        </Label>
      )}
      {hardware.cpu && (
        <Label icon={<MicrochipIcon />} variant="outline" isCompact>
          {hardware.cpu}
        </Label>
      )}
      {hardware.memory !== undefined && (
        <Label icon={<MemoryIcon />} variant="outline" isCompact>
          {formatBytes(hardware.memory)}
        </Label>
      )}
    </div>
  );
}

/** Step 4: pick a product, the selection is sent to the server. */
export function ProductsPage() {
  const { client, setSelectedProduct } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<Data>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setData({ status: "loading" });
    Promise.all([client.getSystem(), client.getConfig().catch(() => undefined)])
      .then(([system, config]) => {
        if (cancelled) return;
        const products = system.products ?? [];
        const current = config?.product?.id;
        setData({ status: "ready", products, hardware: system.hardware, current });
        if (current && products.some((p) => p.id === current)) {
          setSelectedId((id) => id ?? current);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setData({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [client, attempt]);

  if (!client) return null;

  const selected =
    data.status === "ready" ? data.products.find((p) => p.id === selectedId) : undefined;

  /** Sends the selection to the server and continues to the summary. */
  const proceed = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await client.selectProduct(selected.id);
      setSelectedProduct(selected);
      navigate("/summary");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h2 className="page__title">Choose your product</h2>

      {data.status === "loading" && <Loader label="Asking the server what it can install…" />}

      {data.status === "error" && (
        <EmptyState titleText="Could not load the products" headingLevel="h3" status="danger">
          <EmptyStateBody>{data.message}</EmptyStateBody>
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </EmptyState>
      )}

      {data.status === "ready" && data.products.length === 0 && (
        <EmptyState titleText="No products available" headingLevel="h3">
          <EmptyStateBody>The server does not offer any product for installation.</EmptyStateBody>
        </EmptyState>
      )}

      {data.status === "ready" && data.products.length > 0 && (
        <>
          {data.hardware && <Hardware hardware={data.hardware} />}
          <motion.div className="products" variants={listVariants} initial="hidden" animate="show">
            {data.products.map((product) => (
              <ProductCard
                key={product.id}
                client={client}
                product={product}
                selected={product.id === selectedId}
                onSelect={() => setSelectedId(product.id)}
              />
            ))}
          </motion.div>
          {selected && (
            <motion.p
              key={selected.id}
              className="selected-line"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Selected: {selected.name}
            </motion.p>
          )}
          {saveError && (
            <Alert variant="danger" isInline title="Could not select the product">
              {saveError}
            </Alert>
          )}
          <div className="actions actions--end">
            <Button variant="link" icon={<ArrowLeftIcon />} onClick={() => navigate("/")}>
              Change server
            </Button>
            <Button
              variant="primary"
              size="lg"
              isDisabled={!selected || saving}
              isLoading={saving}
              onClick={() => void proceed()}
            >
              {saving ? "Selecting…" : "Select"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
