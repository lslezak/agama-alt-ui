import { Alert, Button, List, ListItem } from "@patternfly/react-core";
import CertificateIcon from "@patternfly/react-icons/dist/esm/icons/certificate-icon";
import CheckCircleIcon from "@patternfly/react-icons/dist/esm/icons/check-circle-icon";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../context/SessionContext";
import { useTrustCheck } from "../hooks/useTrustCheck";

/** Consecutive failed checks after which the troubleshooting hints are shown anyway. */
const HINTS_AFTER_FAILURES = 6;

/**
 * Step 2: the browser does not trust the server certificate. There is no way to accept it from
 * JavaScript so the user has to open the server in a separate tab. We keep polling until the
 * server becomes reachable.
 */
export function TrustPage() {
  const { client, serverUrl } = useSession();
  const navigate = useNavigate();
  const [confirmFailed, setConfirmFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { failures, trusted, checking, checkNow } = useTrustCheck(
    () => client!.ping(),
    () => {
      timer.current = setTimeout(() => navigate("/login", { replace: true }), 1400);
    },
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  const retry = async () => {
    const ok = await checkNow();
    if (!ok) setConfirmFailed(true);
  };

  const showHints = !trusted && (confirmFailed || failures >= HINTS_AFTER_FAILURES);

  return (
    <div className="page page--narrow">
      <div className="hero">
        <motion.div
          className={trusted ? "trust-icon trust-icon--ok" : "trust-icon"}
          animate={trusted ? { scale: [1, 1.4, 1] } : { rotate: [0, -6, 6, -6, 0] }}
          transition={trusted ? { duration: 0.6 } : { duration: 2.5, repeat: Infinity }}
        >
          {trusted ? <CheckCircleIcon /> : <CertificateIcon />}
        </motion.div>
        <h2 className="page__title">
          {trusted ? "Certificate accepted!" : "The server certificate is not trusted"}
        </h2>
      </div>

      {trusted ? (
        <p className="page__text">The server is reachable, moving on…</p>
      ) : (
        <>
          <p className="page__text">
            The server uses a self-signed certificate, so the browser blocks the connection. Open
            the server in a new tab and accept the security warning there (usually{" "}
            <em>Advanced → Proceed</em>). Then come back, this page continues automatically.
          </p>

          <div className="actions">
            <Button
              component="a"
              href={serverUrl ?? undefined}
              target="_blank"
              rel="noopener"
              variant="primary"
              size="lg"
              icon={<ExternalLinkAltIcon />}
              iconPosition="end"
            >
              Open server in a new tab
            </Button>
            <Button variant="secondary" isLoading={checking} onClick={() => void retry()}>
              Retry
            </Button>
            <Button variant="link" onClick={() => navigate("/")}>
              Change server
            </Button>
          </div>

          <p className="waiting">
            <span className="waiting__dot" /> Waiting for the server… ({failures} failed{" "}
            {failures === 1 ? "check" : "checks"})
          </p>

          <AnimatePresence>
            {showHints && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden" }}
              >
                <Alert variant="warning" isInline title="Still cannot connect to the server">
                  <List>
                    <ListItem>Is the server address correct and the machine reachable?</ListItem>
                    <ListItem>
                      <strong>CORS</strong> might not be enabled or this page origin (
                      {window.location.origin}) is not allowed: start the server with the{" "}
                      <code>inst.cors=*</code> boot option (or <code>--enable-cors</code>).
                    </ListItem>
                    <ListItem>A firewall or VPN may be blocking the connection.</ListItem>
                  </List>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
