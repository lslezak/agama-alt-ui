import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  ExpandableSection,
  Label,
} from "@patternfly/react-core";
import { motion, type Variants } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { Config, HardwareInfo, Product } from "../api/types";
import { Loader } from "../components/Loader";
import { ProductLogo } from "../components/ProductLogo";
import { useSession } from "../context/SessionContext";
import { formatBytes } from "../utils/format";

type Data =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      config: Config;
      /** The product the server reports as selected, if it is a known one. */
      product?: Product;
      hardware?: HardwareInfo;
    };

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 160, damping: 16 } },
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <motion.div className="summary__row" variants={rowVariants}>
      <dt className="summary__label">{label}</dt>
      <dd className="summary__value">{children}</dd>
    </motion.div>
  );
}

/** Step 5: what the server knows after the selection, read back from the API. */
export function SummaryPage() {
  const { client, serverUrl, selectedProduct, logout } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<Data>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setData({ status: "loading" });
    Promise.all([client.getConfig(), client.getSystem()])
      .then(([config, system]) => {
        if (cancelled) return;
        const id = config?.product?.id;
        const product = system.products?.find((p) => p.id === id);
        setData({ status: "ready", config: config ?? {}, product, hardware: system.hardware });
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

  return (
    <div className="page page--narrow-ish">
      <h2 className="page__title">Summary</h2>

      {data.status === "loading" && <Loader label="Reading the configuration back…" />}

      {data.status === "error" && (
        <EmptyState titleText="Could not load the summary" headingLevel="h3" status="danger">
          <EmptyStateBody>{data.message}</EmptyStateBody>
          <Button variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </EmptyState>
      )}

      {data.status === "ready" && (
        <SummaryContent
          data={data}
          serverUrl={serverUrl}
          selectedId={selectedProduct?.id}
          showConfig={showConfig}
          onToggleConfig={setShowConfig}
          renderLogo={(p) => <ProductLogo client={client} product={p} size={88} />}
        />
      )}

      <div className="actions">
        <Button variant="primary" onClick={() => navigate("/products")}>
          Choose another product
        </Button>
        <Button variant="secondary" onClick={() => void logout()}>
          Log out
        </Button>
      </div>
    </div>
  );
}

function SummaryContent({
  data,
  serverUrl,
  selectedId,
  showConfig,
  onToggleConfig,
  renderLogo,
}: {
  data: Extract<Data, { status: "ready" }>;
  serverUrl: string | null;
  selectedId?: string;
  showConfig: boolean;
  onToggleConfig: (expanded: boolean) => void;
  renderLogo: (product: Product) => ReactNode;
}) {
  const { config, product, hardware } = data;
  const serverId = config.product?.id;

  // does the server confirm what the wizard selected?
  let status: ReactNode;
  if (!serverId) {
    status = (
      <Alert variant="warning" isInline title="The server configuration has no product selected" />
    );
  } else if (selectedId && selectedId !== serverId) {
    status = (
      <Alert
        variant="warning"
        isInline
        title={`The server reports a different product (${serverId}) than the selected one (${selectedId})`}
      />
    );
  } else {
    status = (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Label color="green" className="summary__confirmed">
          Confirmed by the server
        </Label>
      </motion.div>
    );
  }

  return (
    <>
      <div className="summary__hero">
        {product && (
          <motion.div
            initial={{ scale: 0, rotate: -120 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 12 }}
          >
            {renderLogo(product)}
          </motion.div>
        )}
        <h3 className="summary__name">{product?.name ?? serverId ?? "No product"}</h3>
        {product && <p className="summary__description">{product.description}</p>}
        {status}
      </div>

      <motion.dl className="summary" variants={listVariants} initial="hidden" animate="show">
        <Row label="Server">{serverUrl}</Row>
        {serverId && (
          <Row label="Product ID">
            <code>{serverId}</code>
          </Row>
        )}
        {product && (
          <>
            <Row label="Registration">
              {product.registration ? (
                <Label color="orange" isCompact>
                  required
                </Label>
              ) : (
                "not required"
              )}
            </Row>
            <Row label="Licenses">{product.licenses.length}</Row>
            {product.modes.length > 0 && (
              <Row label="Modes">
                <ul className="summary__list">
                  {product.modes.map((m) => (
                    <li key={m.id}>
                      <strong>{m.name}</strong>
                      {m.description && <span> — {m.description}</span>}
                    </li>
                  ))}
                </ul>
              </Row>
            )}
            {product.desktopSelection && (
              <Row label="Desktop selection">{product.desktopSelection}</Row>
            )}
          </>
        )}
        {hardware?.model && <Row label="Machine">{hardware.model}</Row>}
        {hardware?.cpu && <Row label="CPU">{hardware.cpu}</Row>}
        {hardware?.memory !== undefined && <Row label="Memory">{formatBytes(hardware.memory)}</Row>}
      </motion.dl>

      <ExpandableSection
        toggleText={showConfig ? "Hide server configuration" : "Show server configuration"}
        isExpanded={showConfig}
        onToggle={(_e, expanded) => onToggleConfig(expanded)}
      >
        <pre className="summary__json">{JSON.stringify(config, null, 2)}</pre>
      </ExpandableSection>
    </>
  );
}
